import {
  BoxGeometry,
  createSystem,
  CylinderGeometry,
  Entity,
  Grabbed,
  GrabSystem,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OneHandGrabbable,
  RingGeometry,
  UIKitMLAsset,
} from '@iwsdk/core';
import { BuildPart, GameState } from './lab-components.js';
import { ARM_SIGNAL, LAYOUT, placeGamePanel, toWorld } from './lab.js';
import { NAV, PHASE_BUILD } from './nav.js';
import { markLevelDone } from './progress.js';
import { playSfx } from './sfx.js';

/**
 * Level 3 Part 2, "Build the robot": pinch a loose part and drop it near its
 * glowing spot on the chassis; it snaps in. Wrong spot or nowhere: it goes back
 * with a hint. All 5 attached: GO drives a short demo path (a simplified demo,
 * no physics). Parts have no physics bodies: grabbing moves them, release decides.
 */
const KIND_WHEEL = 0;
const KIND_MOTOR = 1;
const KIND_BOARD = 2;
const HINTS = ['Wheels go on the sides', 'Motors go next to the wheels', 'The board goes in the middle'];
/** Chassis centre (table-local) and its top height. */
const CX = 0;
const CZ = 0.03;
const TOP = 0.045;
/** Spots relative to the chassis centre: x, y, z, kind. */
const SPOTS: [number, number, number, number][] = [
  [-0.125, 0.03, 0.03, KIND_WHEEL],
  [0.125, 0.03, 0.03, KIND_WHEEL],
  [-0.06, TOP + 0.015, 0.03, KIND_MOTOR],
  [0.06, TOP + 0.015, 0.03, KIND_MOTOR],
  [0, TOP + 0.006, -0.035, KIND_BOARD],
];
/** Loose part start spots (table-local x, z) and kinds. */
const LOOSE: [number, number, number][] = [
  [-0.33, -0.03, KIND_WHEEL],
  [-0.33, 0.12, KIND_WHEEL],
  [-0.2, 0.17, KIND_MOTOR],
  [0.22, 0.12, KIND_MOTOR],
  [0.25, -0.03, KIND_BOARD],
];
const REST_Y = [0.03, 0.016, 0.006];
const SNAP = 0.11;
const NAMES = ['Wheel', 'Motor', 'Controller board'];

type UIElement = NonNullable<ReturnType<UIKitMLAsset['getElementById']>>;

const wheelGeo = new CylinderGeometry(0.03, 0.03, 0.022, 20).rotateZ(Math.PI / 2);
const motorGeo = new CylinderGeometry(0.016, 0.016, 0.05, 14).rotateZ(Math.PI / 2);
const boardGeo = new BoxGeometry(0.08, 0.012, 0.05);
const GEOS = [wheelGeo, motorGeo, boardGeo];
const partMats = [
  new MeshStandardMaterial({ color: 0x30343c, roughness: 0.8 }),
  new MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.35, metalness: 0.4 }),
  new MeshStandardMaterial({ color: 0x1f7a4d, roughness: 0.6 }),
];
const SPOT_COLORS = [0xf5c542, 0x3e8ef7, 0x3ddc84];

export class BuildSystem extends createSystem({
  game: { required: [GameState] },
  held: { required: [BuildPart, Grabbed] },
}) {
  private ui: Record<string, UIElement | undefined> = {};
  private uiReady = false;
  private lastPress: Record<string, number> = {};
  private readyAt = 0;
  private entities: Entity[] = [];
  private parts: Entity[] = [];
  private chassis?: Group;
  private chassisMat?: MeshStandardMaterial;
  private spotMeshes: Mesh[] = [];
  private spotMats: MeshBasicMaterial[] = [];
  private filled: (Entity | undefined)[] = [];
  private time = 0;
  private flash = 0;
  private driveT = -1;
  private finishIn = -1;
  private tmp: [number, number, number] = [0, 0, 0];
  private pose = { x: CX, z: CZ, yaw: 0 };

  init(): void {
    NAV.startBuild = () => this.start();
    NAV.stopBuild = () => this.stop();
    this.queries.held.subscribe('disqualify', (e) => this.onRelease(e));
  }

  private phase(): number {
    for (const e of this.queries.game.entities) return e.getValue(GameState, 'phase') ?? 0;
    return 0;
  }

  private bind(id: string, fn: () => void): void {
    const handler = () => {
      if (this.phase() !== PHASE_BUILD) return;
      const now = performance.now();
      if (now < this.readyAt) return;
      if (now - (this.lastPress[id] ?? 0) < 350) return;
      this.lastPress[id] = now;
      fn();
    };
    this.ui[id]?.addEventListener('pointerdown', handler);
    this.cleanupFuncs.push(() => this.ui[id]?.removeEventListener('pointerdown', handler));
  }

  private wireUI(): void {
    if (this.uiReady) return;
    const panel = this.world.getSceneObject<UIKitMLAsset>('game-panel');
    if (panel == null) return;
    for (const id of ['build-msg', 'build-edit', 'build-done', 'build-go', 'menu-button-build', 'menu-button-build-done']) {
      this.ui[id] = panel.getElementById(id) ?? undefined;
    }
    this.bind('build-go', () => this.go());
    this.bind('menu-button-build', () => NAV.toMenu());
    this.bind('menu-button-build-done', () => NAV.toMenu());
    this.uiReady = true;
  }

  private setMsg(text: string): void {
    this.ui['build-msg']?.setProperties({ text });
  }

  start(): void {
    this.wireUI();
    this.build();
    placeGamePanel(this.world);
    this.readyAt = performance.now() + 600;
    this.driveT = -1;
    this.finishIn = -1;
    this.setMsg('Pinch a part');
    this.ui['build-go']?.setProperties({ display: 'none' });
    this.ui['build-edit']?.setProperties({ display: 'flex' });
    this.ui['build-done']?.setProperties({ display: 'none' });
  }

  stop(): void {
    const grab = this.world.getSystem(GrabSystem);
    for (const p of this.parts) if (p.hasComponent(Grabbed)) grab?.forceRelease(p);
    for (const e of this.entities) e.dispose();
    this.entities.length = 0;
    this.parts.length = 0;
    this.spotMeshes.length = 0;
    this.spotMats.length = 0;
    this.filled.length = 0;
    this.chassis = undefined;
    this.driveT = -1;
  }

  private build(): void {
    this.stop();
    this.pose.x = CX;
    this.pose.z = CZ;
    this.pose.yaw = 0;
    // Chassis group: placed at the chassis centre in table-local space each frame it moves.
    const chassis = new Group();
    chassis.name = 'Robot Chassis';
    this.chassisMat = new MeshStandardMaterial({ color: 0xf08a24, roughness: 0.5 });
    const body = new Mesh(new BoxGeometry(0.2, 0.03, 0.14), this.chassisMat);
    body.position.y = 0.015 + 0.015;
    chassis.add(body);
    SPOTS.forEach(([x, y, z, kind]) => {
      const mat = new MeshBasicMaterial({ color: SPOT_COLORS[kind], transparent: true, opacity: 0.6, depthWrite: false });
      const ring = new Mesh(new RingGeometry(0.018, 0.028, 24), mat);
      // Wheel spots face sideways; the others lie on the top.
      if (kind === KIND_WHEEL) {
        ring.rotation.y = Math.PI / 2;
        ring.position.set(x + Math.sign(x) * 0.002, y, z);
      } else {
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, TOP + 0.002, z);
      }
      chassis.add(ring);
      this.spotMeshes.push(ring);
      this.spotMats.push(mat);
      this.filled.push(undefined);
    });
    this.chassis = chassis;
    this.placeChassis();
    this.entities.push(this.world.createTransformEntity(chassis));

    LOOSE.forEach(([x, z, kind], i) => {
      const mesh = new Mesh(GEOS[kind], partMats[kind]);
      mesh.name = `${NAMES[kind]} ${i}`;
      if (kind === KIND_BOARD) {
        // A chip on the board so it reads as a controller board.
        const chip = new Mesh(new BoxGeometry(0.025, 0.006, 0.025), partMats[KIND_WHEEL]);
        chip.position.y = 0.008;
        mesh.add(chip);
      }
      mesh.position.set(...toWorld(x, REST_Y[kind], z, this.tmp));
      mesh.rotation.y = LAYOUT.yaw;
      const e = this.world.createTransformEntity(mesh);
      e.addComponent(BuildPart, { kind, index: i });
      e.addComponent(OneHandGrabbable, {});
      this.entities.push(e);
      this.parts.push(e);
    });
  }

  private placeChassis(): void {
    if (this.chassis == null) return;
    this.chassis.position.set(...toWorld(this.pose.x, 0, this.pose.z, this.tmp));
    this.chassis.rotation.set(0, LAYOUT.yaw + this.pose.yaw, 0);
  }

  /** World position of spot `s` given the chassis pose. */
  private spotWorld(s: number): [number, number, number] {
    const [x, y, z] = SPOTS[s];
    const c = Math.cos(this.pose.yaw);
    const sn = Math.sin(this.pose.yaw);
    return toWorld(this.pose.x + x * c + z * sn, y, this.pose.z - x * sn + z * c, this.tmp);
  }

  private sendHome(e: Entity): void {
    const i = e.getValue(BuildPart, 'index') ?? 0;
    const [x, z, kind] = LOOSE[i];
    const o = e.object3D;
    if (o == null) return;
    o.position.set(...toWorld(x, REST_Y[kind], z, this.tmp));
    o.rotation.set(0, LAYOUT.yaw, 0);
  }

  private onRelease(e: Entity): void {
    if (this.phase() !== PHASE_BUILD || this.driveT >= 0) return;
    if (this.filled.includes(e)) return;
    const o = e.object3D;
    if (o == null) return;
    const kind = e.getValue(BuildPart, 'kind') ?? 0;
    let best = -1;
    let bestD = SNAP;
    for (let s = 0; s < SPOTS.length; s++) {
      if (this.filled[s]) continue;
      const [wx, wy, wz] = this.spotWorld(s);
      const d = Math.hypot(o.position.x - wx, (o.position.y - wy) * 0.5, o.position.z - wz);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    if (best >= 0 && SPOTS[best][3] === kind) {
      this.attach(e, best);
      return;
    }
    playSfx('wrong');
    this.setMsg(best >= 0 ? HINTS[kind] : 'Drop it on a glowing spot');
    this.sendHome(e);
  }

  private attach(e: Entity, s: number): void {
    this.filled[s] = e;
    this.spotMeshes[s].visible = false;
    if (e.hasComponent(OneHandGrabbable)) e.removeComponent(OneHandGrabbable);
    this.placeAttached();
    playSfx('correct');
    this.flash = 1;
    const count = this.filled.filter(Boolean).length;
    if (count === SPOTS.length) {
      this.setMsg('All parts on! Press GO');
      this.ui['build-go']?.setProperties({ display: 'flex' });
      ARM_SIGNAL.celebrateUntil = performance.now() / 1000 + 0.9;
    } else {
      this.setMsg(`${NAMES[SPOTS[s][3]]} attached (${count}/5)`);
    }
  }

  /** Attached parts follow the chassis pose. */
  private placeAttached(): void {
    for (let s = 0; s < SPOTS.length; s++) {
      const o = this.filled[s]?.object3D;
      if (o == null) continue;
      o.position.set(...this.spotWorld(s));
      o.rotation.set(0, LAYOUT.yaw + this.pose.yaw, 0);
    }
  }

  private go(): void {
    if (this.driveT >= 0 || this.filled.filter(Boolean).length < SPOTS.length) return;
    this.ui['build-go']?.setProperties({ display: 'none' });
    this.setMsg('Driving! (simplified demo)');
    this.driveT = 0;
    ARM_SIGNAL.celebrateUntil = performance.now() / 1000 + 5;
  }

  /** Demo path: forward 0.1 m (away), turn around, drive back, turn around. 4.4 s. */
  private drive(t: number): void {
    const ease = (k: number) => k * k * (3 - 2 * k);
    const D = 0.1;
    if (t < 1.4) {
      this.pose.z = CZ - D * ease(t / 1.4);
      this.pose.yaw = 0;
    } else if (t < 2.2) {
      this.pose.z = CZ - D;
      this.pose.yaw = Math.PI * ease((t - 1.4) / 0.8);
    } else if (t < 3.6) {
      this.pose.z = CZ - D + D * ease((t - 2.2) / 1.4);
      this.pose.yaw = Math.PI;
    } else {
      this.pose.z = CZ;
      this.pose.yaw = Math.PI + Math.PI * ease(Math.min(1, (t - 3.6) / 0.8));
    }
    this.placeChassis();
    this.placeAttached();
  }

  update(delta: number): void {
    if (!this.uiReady) this.wireUI();
    if (this.phase() !== PHASE_BUILD) return;
    this.time += delta;
    const pulse = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(this.time * 4));
    for (const m of this.spotMats) m.opacity = pulse;
    if (this.flash > 0 && this.chassisMat) {
      this.flash = Math.max(0, this.flash - delta * 1.5);
      this.chassisMat.emissive.setRGB(0, 0.6 * this.flash, 0.2 * this.flash);
    }
    if (this.driveT >= 0) {
      this.driveT += delta;
      this.drive(this.driveT);
      if (this.driveT > 4.4) {
        this.driveT = -1;
        this.pose.yaw = 0;
        this.placeChassis();
        this.placeAttached();
        this.finishIn = 0.4;
      }
    }
    if (this.finishIn >= 0) {
      this.finishIn -= delta;
      if (this.finishIn < 0) {
        markLevelDone('3b');
        playSfx('end');
        this.ui['build-edit']?.setProperties({ display: 'none' });
        this.ui['build-done']?.setProperties({ display: 'flex' });
      }
    }
  }
}

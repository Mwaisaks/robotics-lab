import {
  BoxGeometry,
  CanvasTexture,
  createSystem,
  CylinderGeometry,
  Entity,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  QuadraticBezierCurve3,
  TubeGeometry,
  AdditiveBlending,
  Pressed,
  RayInteractable,
  SphereGeometry,
  UIKitMLAsset,
  Vector3,
} from '@iwsdk/core';
import { CircuitTap, GameState } from './lab-components.js';
import { ARM_SIGNAL, LAYOUT, placeGamePanel, toWorld } from './lab.js';
import { NAV, PHASE_CIRCUIT } from './nav.js';
import { markLevelDone } from './progress.js';
import { playSfx } from './sfx.js';

/**
 * Level 3, "Light it up": a simplified circuit model on the mat. Pinch one terminal,
 * then another, to add a wire. POWER closes the switch and checks the circuit with
 * simple rules: a closed loop from the battery's + through the switch, resistor and
 * LED (anode toward +) back to -. Not an electrical simulation.
 */

/** Terminals: 0 battery +, 1 battery -, 2/3 switch, 4/5 resistor, 6/7 LED. */
const T_BAT_PLUS = 0;
const T_BAT_MINUS = 1;
const LED_TAP = 8;
type Comp = 'switch' | 'resistor' | 'led';
const COMPS: { name: Comp; a: number; b: number }[] = [
  { name: 'switch', a: 2, b: 3 },
  { name: 'resistor', a: 4, b: 5 },
  { name: 'led', a: 6, b: 7 },
];
/** Table-local terminal positions (x, z); y is TERM_Y above the mat. */
const TERM_POS: [number, number][] = [
  [-0.35, 0.06], [-0.21, 0.06],
  [-0.15, -0.07], [-0.05, -0.07],
  [0.03, -0.07], [0.15, -0.07],
  [0.17, 0.06], [0.33, 0.06],
];
const TERM_Y = 0.02;
const TERM_R = 0.017;
const MAX_WIRES = 10;
const WIRE_COLORS = [0xe5484d, 0x3e8ef7, 0xf5c542, 0x3ddc84, 0xc678dd, 0xff9f43];

const RED = 0xe5484d;
const BLACK = 0x23252b;
const METAL = 0xb8bcc4;
const SELECTED = 0xffe14d;

type UIElement = NonNullable<ReturnType<UIKitMLAsset['getElementById']>>;

const termGeo = new SphereGeometry(TERM_R, 14, 10);
const wireMats = WIRE_COLORS.map((color) => new MeshStandardMaterial({ color, roughness: 0.5 }));

function labelTexture(text: string): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const g = canvas.getContext('2d')!;
  g.fillStyle = 'rgba(20,22,28,0.85)';
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#ffffff';
  g.font = 'bold 34px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 34);
  return new CanvasTexture(canvas);
}

export class CircuitSystem extends createSystem({
  game: { required: [GameState] },
  taps: { required: [CircuitTap, Pressed] },
}) {
  private ui: Record<string, UIElement | undefined> = {};
  private uiReady = false;
  private lastPress: Record<string, number> = {};
  private readyAt = 0;
  private entities: Entity[] = [];
  private root?: Group;
  private wireRoot?: Group;
  private termMats: MeshStandardMaterial[] = [];
  private termMeshes: Mesh[] = [];
  private wires: [number, number][] = [];
  private wireMeshes: Mesh[] = [];
  private selected = -1;
  private ledFlipped = false;
  private ledGroup?: Group;
  private halo?: Mesh;
  private bulbMat?: MeshStandardMaterial;
  private lever?: Mesh;
  private done = false;
  private finishIn = -1;
  private glow = 0;
  private time = 0;
  private tapAt: number[] = [];
  private a = new Vector3();
  private b = new Vector3();

  init(): void {
    NAV.startCircuit = () => this.start();
    NAV.stopCircuit = () => this.stop();
    this.queries.taps.subscribe('qualify', (e) => this.onTap(e.getValue(CircuitTap, 'id') ?? -1));
  }

  private phase(): number {
    for (const e of this.queries.game.entities) return e.getValue(GameState, 'phase') ?? 0;
    return 0;
  }

  /** pointerdown only, debounced, ignored for 0.6 s after the view opens (as in Level 2). */
  private bind(id: string, fn: () => void): void {
    const handler = () => {
      if (this.phase() !== PHASE_CIRCUIT) return;
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
    for (const id of [
      'circ-msg', 'circ-edit', 'circ-done', 'circ-undo', 'circ-clear', 'circ-power',
      'menu-button-circ', 'menu-button-circ-done', 'circ-next', 'circ-part2',
    ]) {
      this.ui[id] = panel.getElementById(id) ?? undefined;
    }
    this.bind('circ-undo', () => {
      if (this.done) return;
      this.wires.pop();
      this.rebuildWires();
      this.setMsg('Pinch two dots to add a wire');
    });
    this.bind('circ-clear', () => {
      if (this.done) return;
      this.wires.length = 0;
      this.select(-1);
      this.rebuildWires();
      this.setMsg('Pinch two dots to add a wire');
    });
    this.bind('circ-power', () => this.power());
    this.bind('menu-button-circ', () => NAV.toMenu());
    this.bind('menu-button-circ-done', () => NAV.toMenu());
    this.bind('circ-next', () => NAV.startLevel(4));
    this.bind('circ-part2', () => NAV.startLevel(4));
    this.uiReady = true;
  }

  private setMsg(text: string): void {
    this.ui['circ-msg']?.setProperties({ text });
  }

  start(): void {
    this.wireUI();
    this.build();
    placeGamePanel(this.world);
    this.readyAt = performance.now() + 600;
    this.wires.length = 0;
    this.selected = -1;
    this.ledFlipped = false;
    this.done = false;
    this.finishIn = -1;
    this.glow = 0;
    this.applyLed();
    this.rebuildWires();
    this.setMsg('Pinch two dots to add a wire');
    this.ui['circ-edit']?.setProperties({ display: 'flex' });
    this.ui['circ-done']?.setProperties({ display: 'none' });
  }

  stop(): void {
    for (const e of this.entities) e.dispose();
    this.entities.length = 0;
    this.root = undefined;
    this.wireRoot = undefined;
    this.wireMeshes.length = 0;
    this.termMeshes.length = 0;
    this.termMats.length = 0;
  }

  /** Bench parts. One root follows the mat; tappable parts are their own entities. */
  private build(): void {
    this.stop();
    const tmp: [number, number, number] = [0, 0, 0];
    const root = new Group();
    root.name = 'Circuit Bench';
    root.position.set(...toWorld(0, 0, 0, tmp));
    root.rotation.y = LAYOUT.yaw;
    this.root = root;
    const rootEntity = this.world.createTransformEntity(root);
    this.entities.push(rootEntity);

    const mat = (color: number, extra = {}) => new MeshStandardMaterial({ color, roughness: 0.6, ...extra });
    const add = (mesh: Mesh, x: number, y: number, z: number) => {
      mesh.position.set(x, y, z);
      root.add(mesh);
      return mesh;
    };
    const label = (text: string, x: number, z: number) => {
      const plane = new Mesh(
        new PlaneGeometry(0.09, 0.0225),
        new MeshBasicMaterial({ map: labelTexture(text), transparent: true }),
      );
      plane.rotation.x = -1.0; // tilted up toward the seated player
      add(plane, x, 0.012, z);
    };

    // Battery (+ end red, - end dark).
    add(new Mesh(new BoxGeometry(0.1, 0.035, 0.05), mat(0x3a3f4b)), -0.28, 0.0175, 0.06);
    add(new Mesh(new BoxGeometry(0.02, 0.036, 0.051), mat(RED)), -0.32, 0.018, 0.06);
    label('Battery', -0.28, 0.115);

    // Switch: base plus a lever that closes when POWER is pressed.
    add(new Mesh(new BoxGeometry(0.075, 0.014, 0.04), mat(0x2d6cdf)), -0.1, 0.007, -0.07);
    this.lever = add(new Mesh(new BoxGeometry(0.06, 0.006, 0.012), mat(METAL)), -0.1, 0.022, -0.07);
    this.setLever(false);
    label('Switch', -0.1, -0.015);

    // Resistor: beige body with colour bands.
    add(
      new Mesh(new CylinderGeometry(0.011, 0.011, 0.07, 12).rotateZ(Math.PI / 2), mat(0xd9c39a)),
      0.09, 0.016, -0.07,
    );
    for (const [x, c] of [[0.072, 0x8b4513], [0.084, 0x111111], [0.096, 0xe5484d]] as const) {
      add(new Mesh(new CylinderGeometry(0.0115, 0.0115, 0.005, 12).rotateZ(Math.PI / 2), mat(c)), x, 0.016, -0.07);
    }
    label('Resistor', 0.09, -0.015);

    // LED: bulb on a small base; pinch it to flip which leg is +.
    const led = new Group();
    led.position.set(0.25, 0, 0.06);
    led.name = 'LED';
    this.bulbMat = mat(0xff5a5a, { emissive: 0xff2020, emissiveIntensity: 0, transparent: true, opacity: 0.9 });
    const bulb = new Mesh(new SphereGeometry(0.022, 16, 12), this.bulbMat);
    bulb.position.y = 0.032;
    const base = new Mesh(new CylinderGeometry(0.024, 0.024, 0.012, 16), mat(0xdddddd));
    base.position.y = 0.006;
    led.add(base, bulb);
    // Halo shown only when the LED lights up.
    this.halo = new Mesh(
      new SphereGeometry(0.05, 16, 12),
      new MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }),
    );
    this.halo.position.y = 0.032;
    this.halo.visible = false;
    led.add(this.halo);
    // "+" marker (long leg) shown as a red stripe on the anode side.
    const marker = new Mesh(new BoxGeometry(0.012, 0.013, 0.03), mat(RED));
    marker.position.set(-0.02, 0.006, 0);
    led.add(marker);
    root.add(led);
    this.ledGroup = led;
    const ledEntity = this.world.createTransformEntity(led, rootEntity);
    ledEntity.addComponent(CircuitTap, { id: LED_TAP });
    ledEntity.addComponent(RayInteractable);
    this.entities.push(ledEntity);
    label('LED (pinch to flip)', 0.25, 0.115);

    // Controller board: on the bench for later labs, not part of this circuit.
    add(new Mesh(new BoxGeometry(0.13, 0.008, 0.07), mat(0x1f7a4d)), 0.0, 0.004, 0.11);
    for (let i = 0; i < 6; i++) {
      add(new Mesh(new BoxGeometry(0.008, 0.006, 0.008), mat(0x111111)), -0.05 + i * 0.02, 0.011, 0.085);
    }
    add(new Mesh(new BoxGeometry(0.03, 0.006, 0.03), mat(0x222222)), 0.0, 0.011, 0.115);
    label('Controller board', 0.0, 0.17);

    // Terminals: tappable spheres.
    this.termMats.length = 0;
    this.termMeshes.length = 0;
    TERM_POS.forEach(([x, z], id) => {
      const m = mat(METAL, { emissive: 0x000000 });
      const mesh = new Mesh(termGeo, m);
      mesh.position.set(x, TERM_Y, z);
      mesh.name = `Terminal ${id}`;
      root.add(mesh);
      const e = this.world.createTransformEntity(mesh, rootEntity);
      e.addComponent(CircuitTap, { id });
      e.addComponent(RayInteractable);
      this.entities.push(e);
      this.termMats[id] = m;
      this.termMeshes[id] = mesh;
    });

    const wireRoot = new Group();
    root.add(wireRoot);
    this.wireRoot = wireRoot;
    this.paintTerminals();
  }

  private anode(): number {
    return this.ledFlipped ? 7 : 6;
  }

  private paintTerminals(): void {
    for (let id = 0; id < this.termMats.length; id++) {
      let color = METAL;
      if (id === T_BAT_PLUS || id === this.anode()) color = RED;
      if (id === T_BAT_MINUS || (id >= 6 && id !== this.anode())) color = BLACK;
      if (id === this.selected) color = SELECTED;
      this.termMats[id].color.setHex(color);
      this.termMats[id].emissive.setHex(id === this.selected ? 0x806000 : 0x000000);
      this.termMeshes[id]?.scale.setScalar(id === this.selected ? 1.3 : 1);
    }
  }

  private applyLed(): void {
    if (this.ledGroup) this.ledGroup.rotation.y = this.ledFlipped ? Math.PI : 0;
    if (this.bulbMat) this.bulbMat.emissiveIntensity = 0;
    if (this.halo) this.halo.visible = false;
    this.paintTerminals();
  }

  private setLever(closed: boolean): void {
    if (this.lever) this.lever.rotation.z = closed ? 0 : 0.5;
  }

  private select(id: number): void {
    this.selected = id;
    this.paintTerminals();
  }

  private onTap(id: number): void {
    if (this.phase() !== PHASE_CIRCUIT || this.done || id < 0) return;
    // Per-dot debounce; a hand sweeping back over the dot it just selected
    // (within 0.8 s) does not deselect it.
    const now = performance.now();
    if (now < this.readyAt || now - (this.tapAt[id] ?? 0) < 800) return;
    this.tapAt[id] = now;
    if (id === LED_TAP) {
      this.ledFlipped = !this.ledFlipped;
      this.setLever(false);
      this.applyLed();
      playSfx('grab');
      this.setMsg('LED flipped');
      return;
    }
    if (this.selected < 0) {
      this.select(id);
      playSfx('grab');
      this.setMsg('Now pinch another dot');
      return;
    }
    if (this.selected === id) {
      this.select(-1);
      this.setMsg('Pinch two dots to add a wire');
      return;
    }
    const a = Math.min(this.selected, id);
    const b = Math.max(this.selected, id);
    this.select(-1);
    if (this.wires.some(([x, y]) => x === a && y === b)) {
      this.setMsg('Those dots are already wired');
      return;
    }
    if (this.wires.length >= MAX_WIRES) {
      this.setMsg('Too many wires. Try UNDO.');
      return;
    }
    this.wires.push([a, b]);
    this.setLever(false);
    if (this.bulbMat) this.bulbMat.emissiveIntensity = 0;
    this.rebuildWires();
    playSfx('grab');
    this.setMsg(`Wire added (${this.wires.length})`);
  }

  /** Wires: an arched tube per wire (rebuilt only when wires change), so long wires clear the parts. */
  private rebuildWires(): void {
    const wr = this.wireRoot;
    if (wr == null) return;
    for (const m of this.wireMeshes) {
      wr.remove(m);
      m.geometry.dispose();
    }
    this.wireMeshes.length = 0;
    this.wires.forEach(([i, j], n) => {
      this.a.set(TERM_POS[i][0], TERM_Y + 0.008, TERM_POS[i][1]);
      this.b.set(TERM_POS[j][0], TERM_Y + 0.008, TERM_POS[j][1]);
      const lift = 0.03 + 0.25 * this.a.distanceTo(this.b);
      const mid = new Vector3().addVectors(this.a, this.b).multiplyScalar(0.5);
      mid.y += lift;
      const curve = new QuadraticBezierCurve3(this.a.clone(), mid, this.b.clone());
      const mesh = new Mesh(new TubeGeometry(curve, 16, 0.0045, 6), wireMats[n % wireMats.length]);
      wr.add(mesh);
      this.wireMeshes.push(mesh);
    });
  }

  /**
   * Rule check: every simple path from battery + to battery - through the parts
   * (each part entered at one terminal, left at the other). Wires join terminals
   * into nets.
   */
  private check(): { ok: boolean; msg: string } {
    const parent = [0, 1, 2, 3, 4, 5, 6, 7];
    const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    for (const [a, b] of this.wires) parent[find(a)] = find(b);
    const net = (t: number) => find(t);

    type Path = { comps: Set<Comp>; ledForward: boolean };
    const paths: Path[] = [];
    const used = new Set<Comp>();
    let ledForward = false;
    const walk = (current: number) => {
      if (current === net(T_BAT_MINUS)) {
        paths.push({ comps: new Set(used), ledForward });
        return;
      }
      for (const c of COMPS) {
        if (used.has(c.name)) continue;
        for (const [inT, outT] of [[c.a, c.b], [c.b, c.a]]) {
          if (net(inT) !== current) continue;
          used.add(c.name);
          const prev = ledForward;
          if (c.name === 'led') ledForward = inT === this.anode();
          walk(net(outT));
          ledForward = prev;
          used.delete(c.name);
        }
      }
    };
    walk(net(T_BAT_PLUS));

    if (paths.length === 0) return { ok: false, msg: "The circuit isn't closed" };
    const withLed = paths.filter((p) => p.comps.has('led'));
    if (withLed.length === 0) return { ok: false, msg: 'Put the LED in the loop' };
    const forward = withLed.filter((p) => p.ledForward);
    if (forward.length === 0) return { ok: false, msg: 'Flip the LED' };
    const safe = forward.filter((p) => p.comps.has('resistor'));
    if (safe.length === 0) return { ok: false, msg: 'Add a resistor to protect the LED' };
    if (!safe.some((p) => p.comps.has('switch'))) return { ok: false, msg: 'Add the switch to the loop' };
    return { ok: true, msg: 'It lights up!' };
  }

  private power(): void {
    if (this.done) return;
    this.select(-1);
    this.setLever(true);
    const result = this.check();
    this.setMsg(result.msg);
    if (!result.ok) {
      playSfx('wrong');
      this.glow = 0;
      return;
    }
    this.done = true;
    this.glow = 0.01;
    playSfx('correct');
    ARM_SIGNAL.celebrateUntil = performance.now() / 1000 + 1.2;
    this.finishIn = 1.4;
  }

  private showDone(): void {
    markLevelDone('3a');
    this.ui['circ-edit']?.setProperties({ display: 'none' });
    this.ui['circ-done']?.setProperties({ display: 'flex' });
    playSfx('end');
  }

  update(delta: number): void {
    if (!this.uiReady) this.wireUI();
    if (this.phase() !== PHASE_CIRCUIT) return;
    this.time += delta;
    if (this.glow > 0 && this.bulbMat) {
      this.glow = Math.min(1, this.glow + delta * 2);
      this.bulbMat.emissiveIntensity = this.glow * (3 + 0.6 * Math.sin(this.time * 6));
      if (this.halo) {
        this.halo.visible = true;
        (this.halo.material as MeshBasicMaterial).opacity = this.glow * (0.45 + 0.1 * Math.sin(this.time * 6));
      }
    }
    if (this.finishIn >= 0) {
      this.finishIn -= delta;
      if (this.finishIn < 0) this.showDone();
    }
  }
}

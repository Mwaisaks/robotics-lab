import {
  createSystem,
  Entity,
  OneHandGrabbable,
  PhysicsSystem,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { BuildPart, GameState, Part } from '../lab-components.js';
import { LAYOUT, placeGamePanel, TABLE, toWorld } from '../lab.js';
import { learning } from '../learning.js';
import { PHASE_BUILD, PHASE_PLAYING, PHASE_TUTORIAL } from '../nav.js';
import { playSfx } from '../sfx.js';
import { WEB } from './state.js';

/**
 * Browser mode (no headset). IWSDK already renders the scene on the flat page and
 * forwards canvas mouse/touch events to UI panels and RayInteractables
 * (input.canvasPointerEvents, CanvasPointerSystem), which covers Level 2's block
 * buttons and Level 3's terminal taps. What it does not do is move
 * OneHandGrabbable parts along the table with a screen pointer, so this system:
 * - places a fixed camera above and in front of the table, fitted to the screen;
 * - moves the game panel behind the table so it doesn't cover the parts;
 * - drags parts with pointer events: press on a part = pick, move = carry it just
 *   above the table, release = drop. Level 1: physics and GameSystem decide the
 *   result exactly as in the headset (same scoring, sounds, arm, events).
 *   Build the robot: BuildSystem's own release check snaps or returns the part.
 */
type DragKind = 'sort' | 'build';
const LIFT = 0.1; // Level 1 parts float this high above the table (above GameSystem's placement check)
const BUILD_LIFT = 0.07; // Build parts: close to the chassis spots so a drop near one snaps
const EDGE = 0.04; // keep carried parts this far inside the table edge
const PITCH = (55 * Math.PI) / 180; // camera looks down at the table at this angle
const VIEW_HALF_WIDTH = 0.56; // metres of table (+ arm) to fit across the screen
const MIN_DISTANCE = 1.0;
const PANEL_LOCAL: [number, number, number] = [0, 0.2, -0.38];
const IDENTITY: [number, number, number, number] = [0, 0, 0, 1];

export class BrowserModeSystem extends createSystem({
  parts: { required: [Part] },
  buildParts: { required: [BuildPart, OneHandGrabbable] },
  game: { required: [GameState] },
}) {
  private kind: DragKind | null = null;
  private raycaster = new Raycaster();
  private ndc = new Vector2();
  private plane = new Plane(new Vector3(0, 1, 0), 0);
  private hit = new Vector3();
  private look = new Vector3();
  private tmp: [number, number, number] = [0, 0, 0];
  private target: [number, number, number] = [0, 0, 0];
  private pointerId = -1;
  private layoutApplied = false;

  init(): void {
    const canvas = this.renderer.domElement;
    canvas.style.touchAction = 'none'; // drags must not scroll or zoom the page on phones
    const down = (e: PointerEvent) => this.onDown(e);
    const move = (e: PointerEvent) => {
      if (e.pointerId === this.pointerId) this.carryTo(e);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId === this.pointerId) this.release();
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    this.cleanupFuncs.push(
      () => canvas.removeEventListener('pointerdown', down),
      () => canvas.removeEventListener('pointermove', move),
      () => canvas.removeEventListener('pointerup', up),
      () => canvas.removeEventListener('pointercancel', up),
    );
  }

  private active(): boolean {
    return WEB.active && this.world.visibilityState.peek() === VisibilityState.NonImmersive;
  }

  /** What can be dragged in the current phase, if anything. */
  private dragKind(): DragKind | null {
    for (const e of this.queries.game.entities) {
      const phase = e.getValue(GameState, 'phase');
      if (phase === PHASE_PLAYING || phase === PHASE_TUTORIAL) return 'sort';
      if (phase === PHASE_BUILD) return 'build';
      return null;
    }
    return null;
  }

  private lift(): number {
    return this.kind === 'build' ? BUILD_LIFT : LIFT;
  }

  private aim(e: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
  }

  private onDown(e: PointerEvent): void {
    const kind = this.dragKind();
    if (!this.active() || kind == null || WEB.dragged != null) return;
    this.aim(e);
    let best: Entity | null = null;
    let bestDistance = Infinity;
    // Build parts lose OneHandGrabbable once attached, so only loose ones can be picked.
    const candidates = kind === 'sort' ? this.queries.parts.entities : this.queries.buildParts.entities;
    for (const part of candidates) {
      const obj = part.object3D;
      if (obj == null) continue;
      const hits = this.raycaster.intersectObject(obj, true);
      if (hits.length > 0 && hits[0].distance < bestDistance) {
        bestDistance = hits[0].distance;
        best = part;
      }
    }
    if (best == null) return;
    this.kind = kind;
    WEB.dragged = best;
    this.pointerId = e.pointerId;
    this.renderer.domElement.setPointerCapture(e.pointerId);
    const p = best.object3D!.position;
    this.target[0] = p.x;
    this.target[1] = LAYOUT.topY + this.lift();
    this.target[2] = p.z;
    if (kind === 'sort') {
      // Same feedback as a hand grab of a Level 1 part (GameSystem's Grabbed subscription).
      playSfx('grab');
      learning.action('sort', 'grab_part');
    }
    this.carryTo(e);
  }

  /** Point under the pointer on a plane just above the table, kept inside the table. */
  private carryTo(e: PointerEvent): void {
    if (WEB.dragged == null) return;
    this.aim(e);
    this.plane.constant = -(LAYOUT.topY + this.lift());
    if (this.raycaster.ray.intersectPlane(this.plane, this.hit) == null) return;
    const c = Math.cos(LAYOUT.yaw);
    const s = Math.sin(LAYOUT.yaw);
    const dx = this.hit.x - LAYOUT.x;
    const dz = this.hit.z - LAYOUT.z;
    const maxX = TABLE.width / 2 - EDGE;
    const maxZ = TABLE.depth / 2 - EDGE;
    const lx = Math.min(maxX, Math.max(-maxX, dx * c - dz * s));
    const lz = Math.min(maxZ, Math.max(-maxZ, dx * s + dz * c));
    toWorld(lx, this.lift(), lz, this.target);
  }

  /**
   * Drop. Level 1: the part falls onto the table or a bin; GameSystem scores it once
   * it rests. Build: BuildSystem snaps it to a matching spot or sends it home.
   * `checkDrop` is false when the drag is cancelled (phase changed, part removed).
   */
  private release(checkDrop = true): void {
    if (this.pointerId >= 0) {
      const canvas = this.renderer.domElement;
      if (canvas.hasPointerCapture(this.pointerId)) canvas.releasePointerCapture(this.pointerId);
    }
    const part = WEB.dragged;
    const kind = this.kind;
    this.pointerId = -1;
    this.kind = null;
    WEB.dragged = null;
    if (checkDrop && part != null && kind === 'build') WEB.onBuildDrop(part);
  }

  private placeCamera(): void {
    const cam = this.camera;
    const halfV = ((cam.fov * Math.PI) / 180) / 2;
    const halfH = Math.atan(Math.tan(halfV) * cam.aspect);
    const distance = Math.max(MIN_DISTANCE, VIEW_HALF_WIDTH / Math.tan(halfH));
    toWorld(0.03, 0.14, -0.08, this.tmp); // middle of table + panel
    this.look.set(this.tmp[0], this.tmp[1], this.tmp[2]);
    const flat = Math.cos(PITCH) * distance;
    cam.position.set(
      this.look.x + Math.sin(LAYOUT.yaw) * flat,
      this.look.y + Math.sin(PITCH) * distance,
      this.look.z + Math.cos(LAYOUT.yaw) * flat,
    );
    cam.lookAt(this.look);
  }

  /** Game panel stands behind the table, facing the camera. */
  private placePanel(): void {
    const panel = this.world.getSceneEntity('game-panel')?.object3D;
    if (panel == null) return;
    toWorld(PANEL_LOCAL[0], PANEL_LOCAL[1], PANEL_LOCAL[2], this.tmp);
    panel.position.set(this.tmp[0], this.tmp[1], this.tmp[2]);
    panel.lookAt(this.camera.position);
  }

  update(): void {
    if (!this.active()) {
      if (WEB.dragged != null) this.release(false);
      if (this.layoutApplied) {
        this.layoutApplied = false;
        placeGamePanel(this.world); // back to the headset layout
      }
      return;
    }
    this.layoutApplied = true;
    this.placeCamera();
    this.placePanel();

    const part = WEB.dragged;
    if (part == null) return;
    const stillThere =
      this.kind === 'sort' ? this.queries.parts.entities.has(part) : this.queries.buildParts.entities.has(part);
    if (this.dragKind() !== this.kind || !stillThere) {
      this.release(false);
      return;
    }
    if (this.kind === 'build') {
      // Build parts have no physics body: move the object like a hand would.
      part.object3D?.position.set(this.target[0], this.target[1], this.target[2]);
      return;
    }
    // Held in place every frame (also clears its velocity), like a hand holding it.
    this.world
      .getSystem(PhysicsSystem)
      ?.setBodyTransform(part, { position: this.target, quaternion: IDENTITY });
  }
}

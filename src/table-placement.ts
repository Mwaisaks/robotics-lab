import {
  createSystem,
  Quaternion,
  Vector3,
  VisibilityState,
  XRMesh,
  XRPlane,
} from '@iwsdk/core';
import { GameState } from './lab-components.js';
import { PHASE_MENU } from './nav.js';
import { DEFAULT_LAYOUT, LAYOUT, relocateLab, TABLE } from './lab.js';

/**
 * Step 3b: on XR session start, look for a real table in front of the seated
 * player (scene understanding: XRMesh / XRPlane labeled "table" or "desk") and
 * move the play area onto it. If none qualifies within SEARCH_SECONDS, keep the
 * fixed seated spot (DEFAULT_LAYOUT). The fallback always works.
 *
 * API source: node_modules/@iwsdk/core/dist/scene-understanding/*.d.ts
 * (XRMesh: isBounded3D, semanticLabel, max = half extents; XRPlane: _plane is the
 * WebXR XRPlane with orientation, semanticLabel, polygon).
 */
const SEARCH_SECONDS = 2;
const TABLE_LABELS = ['table', 'desk'];
const MIN_TOP = 0.4;
const MAX_TOP = 1.1;
const MAX_EDGE_DISTANCE = 0.9; // seated reach to the table's near edge
const MIN_FRONT_DOT = 0.5; // within about 60 degrees of where the player looks
const MIN_SIZE = 0.25;
const INSET = TABLE.depth / 2 + 0.02; // play-area center inset from the near edge

export const PLACEMENT_FALLBACK = 0;
export const PLACEMENT_TABLE = 1;

type Candidate = { cx: number; cz: number; yaw: number; hx: number; hz: number; top: number };

export class TablePlacementSystem extends createSystem({
  meshes: { required: [XRMesh] },
  planes: { required: [XRPlane] },
  game: { required: [GameState] },
}) {
  private searching = false;
  private elapsed = 0;
  private head = new Vector3();
  private forward = new Vector3();
  private center = new Vector3();
  private quat = new Quaternion();
  private axis = new Vector3();
  private cand: Candidate = { cx: 0, cz: 0, yaw: 0, hx: 0, hz: 0, top: 0 };
  private best = { score: Infinity, x: 0, z: 0, yaw: 0, top: 0, label: '' };
  /** Why the most recent table candidates were rejected (for the console log). */
  private rejected: string[] = [];
  private tablesSeen = 0;

  init(): void {
    // Search once per XR session start (NonImmersive -> immersive), not on blur/unblur.
    let wasImmersive = false;
    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((state) => {
        const immersive = state !== VisibilityState.NonImmersive;
        if (immersive && !wasImmersive) {
          this.searching = true;
          this.elapsed = 0;
        } else if (!immersive) {
          this.searching = false;
        }
        wasImmersive = immersive;
      }),
    );
  }

  private setPlacement(value: number): void {
    for (const e of this.queries.game.entities) e.setValue(GameState, 'placement', value);
  }

  private phase(): number {
    for (const e of this.queries.game.entities) return e.getValue(GameState, 'phase') ?? 0;
    return 0;
  }

  /** Yaw of an object's local X axis in world space. */
  private yawOf(q: Quaternion): number {
    this.axis.set(1, 0, 0).applyQuaternion(q);
    return Math.atan2(-this.axis.z, this.axis.x);
  }

  /** Scores a table candidate; keeps the nearest one that passes every check. */
  private consider(c: Candidate, label: string): void {
    this.tablesSeen++;
    const reject = (why: string) => {
      if (this.rejected.length < 6) this.rejected.push(`${label}: ${why}`);
    };
    if (c.top < MIN_TOP || c.top > MAX_TOP) {
      reject(`top ${c.top.toFixed(2)} m not in ${MIN_TOP}-${MAX_TOP} m`);
      return;
    }
    if (2 * Math.min(c.hx, c.hz) < MIN_SIZE) {
      reject(`too small (${(2 * c.hx).toFixed(2)} x ${(2 * c.hz).toFixed(2)} m)`);
      return;
    }
    const cos = Math.cos(c.yaw);
    const sin = Math.sin(c.yaw);
    // Head in table-local coordinates, then the nearest point on the table top.
    const wx = this.head.x - c.cx;
    const wz = this.head.z - c.cz;
    const lx = Math.max(-c.hx, Math.min(c.hx, wx * cos - wz * sin));
    const lz = Math.max(-c.hz, Math.min(c.hz, wx * sin + wz * cos));
    const px = c.cx + lx * cos + lz * sin;
    const pz = c.cz - lx * sin + lz * cos;
    const edge = Math.hypot(px - this.head.x, pz - this.head.z);
    if (edge > MAX_EDGE_DISTANCE) {
      reject(`near edge ${edge.toFixed(2)} m away (max ${MAX_EDGE_DISTANCE})`);
      return;
    }
    // In front of the player.
    const tx = c.cx - this.head.x;
    const tz = c.cz - this.head.z;
    const tl = Math.hypot(tx, tz) || 1;
    if ((tx * this.forward.x + tz * this.forward.z) / tl < MIN_FRONT_DOT) {
      reject('not in front of the player');
      return;
    }
    if (edge >= this.best.score) return;
    // Play-area center: from the near edge, inset toward the table center.
    const ix = c.cx - px;
    const iz = c.cz - pz;
    const il = Math.hypot(ix, iz);
    const step = il > 1e-4 ? Math.min(INSET, il) / il : 0;
    const qx = px + ix * step;
    const qz = pz + iz * step;
    // Face the player: local +Z points from the play area toward the head.
    this.best.score = edge;
    this.best.x = qx;
    this.best.z = qz;
    this.best.yaw = Math.atan2(this.head.x - qx, this.head.z - qz);
    this.best.top = c.top;
    this.best.label = `${label}, top ${c.top.toFixed(2)} m, near edge ${edge.toFixed(2)} m away`;
  }

  private findTable(): boolean {
    this.player.head.getWorldPosition(this.head);
    this.player.head.getWorldQuaternion(this.quat);
    this.forward.set(0, 0, -1).applyQuaternion(this.quat);
    this.forward.y = 0;
    this.forward.normalize();
    this.best.score = Infinity;
    this.rejected.length = 0;
    this.tablesSeen = 0;

    for (const e of this.queries.meshes.entities) {
      const label = (e.getValue(XRMesh, 'semanticLabel') ?? '').toLowerCase();
      if (!e.getValue(XRMesh, 'isBounded3D') || !TABLE_LABELS.includes(label)) continue;
      const obj = e.object3D;
      if (obj == null) continue;
      obj.getWorldPosition(this.center);
      obj.getWorldQuaternion(this.quat);
      const half = e.getVectorView(XRMesh, 'max');
      this.cand.cx = this.center.x;
      this.cand.cz = this.center.z;
      this.cand.yaw = this.yawOf(this.quat);
      this.cand.hx = half[0];
      this.cand.hz = half[2];
      this.cand.top = this.center.y + half[1];
      this.consider(this.cand, `mesh '${label}'`);
    }

    for (const e of this.queries.planes.entities) {
      const plane = e.getValue(XRPlane, '_plane') as XRPlane | undefined;
      const label = (plane?.semanticLabel ?? '').toLowerCase();
      if (plane == null || plane.orientation !== 'horizontal' || !TABLE_LABELS.includes(label)) {
        continue;
      }
      const obj = e.object3D;
      if (obj == null || plane.polygon.length < 3) continue;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const p of plane.polygon) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
      }
      obj.getWorldQuaternion(this.quat);
      // Polygon bbox center, plane-local -> world.
      this.center.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2).applyQuaternion(this.quat);
      obj.getWorldPosition(this.axis);
      this.center.add(this.axis);
      this.cand.cx = this.center.x;
      this.cand.cz = this.center.z;
      this.cand.top = this.center.y;
      this.cand.yaw = this.yawOf(this.quat);
      this.cand.hx = (maxX - minX) / 2;
      this.cand.hz = (maxZ - minZ) / 2;
      this.consider(this.cand, `plane '${label}'`);
    }
    return this.best.score < Infinity;
  }

  update(delta: number): void {
    if (!this.searching) return;
    this.elapsed += delta;
    const phase = this.phase();
    if ((phase === 0 || phase === PHASE_MENU) && this.findTable()) {
      this.searching = false;
      relocateLab(this.world, {
        x: this.best.x,
        // Our play mat sits on the real surface.
        topY: this.best.top + TABLE.thickness,
        z: this.best.z,
        yaw: this.best.yaw,
      });
      this.setPlacement(PLACEMENT_TABLE);
      console.info(`[Placement] placed on table (${this.best.label})`);
      return;
    }
    if (this.elapsed >= SEARCH_SECONDS) {
      this.searching = false;
      if (LAYOUT.x !== DEFAULT_LAYOUT.x || LAYOUT.z !== DEFAULT_LAYOUT.z) {
        relocateLab(this.world, DEFAULT_LAYOUT);
      }
      this.setPlacement(PLACEMENT_FALLBACK);
      const meshes = this.queries.meshes.entities.size;
      const planes = this.queries.planes.entities.size;
      let reason: string;
      if (meshes + planes === 0) {
        reason = 'no scene data (no room setup, or spatial data permission denied)';
      } else if (this.tablesSeen === 0) {
        reason = `no table/desk labelled in scene data (${meshes} meshes, ${planes} planes)`;
      } else {
        reason = `tables rejected: ${this.rejected.join('; ')}`;
      }
      if (this.phase() !== 0 && this.phase() !== PHASE_MENU) reason = 'a level is already in progress';
      console.info(`[Placement] fallback: fixed spot (${reason})`);
    }
  }
}

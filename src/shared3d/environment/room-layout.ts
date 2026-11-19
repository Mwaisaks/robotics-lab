/**
 * Pure data for the procedural lab room: a list of axis-aligned boxes and a tiny
 * merger that packs them into flat vertex arrays (position, normal, colour, index).
 * No three.js here, so it is unit-tested in tests/shared3d/.
 *
 * Room-local coordinates: metres, y = 0 is the floor, (x 0, z 0) is the middle of
 * the play table (LAYOUT.x, LAYOUT.z). The room is open toward +z (the player and
 * the browser camera), so nothing sits in front of the table.
 */

/** 0 = lit (matte) group, 1 = self-lit group (window, ceiling lights). */
export type BoxGroup = 0 | 1;

export interface RoomBox {
  /** Centre [x, y, z]. */
  c: readonly [number, number, number];
  /** Size [width x, height y, depth z]. */
  s: readonly [number, number, number];
  /** sRGB colour, 0xRRGGBB. */
  color: number;
  group?: BoxGroup;
}

export interface MergedBoxes {
  position: Float32Array;
  normal: Float32Array;
  color: Float32Array;
  index: Uint32Array;
  boxCount: number;
}

/** The play table + arm + browser panel live inside this footprint; the room keeps out of it. */
export const KEEP_CLEAR = { minX: -1.2, maxX: 1.2, minZ: -1.4, maxZ: 1.8 } as const;

const WALL_H = 2.4;
const HALF_W = 2.6; // side walls at x = +-HALF_W
const BACK_Z = -2.2; // inner face of the back wall
const FRONT_Z = 1.8; // floor ends here, behind the player
const SIDE_FRONT_Z = 0.6; // side walls stop here so the room is open toward the player

const C = {
  floor: 0xe9ebee,
  mat: 0xdde1e6,
  wall: 0xf7f8f9,
  skirting: 0xd2d6db,
  stripe: 0x2fb3a5,
  benchTop: 0xf3f2ee,
  metal: 0xb9c0c7,
  shelf: 0xe4e7ea,
  window: 0xe8f4fb,
  light: 0xffffff,
};

function bench(boxes: RoomBox[], x0: number, x1: number, z0: number, z1: number): void {
  const top = 0.85;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  boxes.push({ c: [cx, top - 0.02, cz], s: [x1 - x0, 0.04, z1 - z0], color: C.benchTop });
  const leg = 0.05;
  for (const lx of [x0 + 0.05, x1 - 0.05]) {
    for (const lz of [z0 + 0.05, z1 - 0.05]) {
      boxes.push({ c: [lx, (top - 0.04) / 2, lz], s: [leg, top - 0.04, leg], color: C.metal });
    }
  }
  // lower shelf board
  boxes.push({ c: [cx, 0.2, cz], s: [x1 - x0 - 0.1, 0.03, z1 - z0 - 0.1], color: C.metal });
}

/** Every box in the room. Deterministic; built once. */
export function buildRoomBoxes(): RoomBox[] {
  const boxes: RoomBox[] = [];
  const width = HALF_W * 2;
  const sideLen = SIDE_FRONT_Z - BACK_Z;
  const sideZ = (SIDE_FRONT_Z + BACK_Z) / 2;

  // Floor (top at y = -0.01, below the scene's shadow catcher at +0.001) and a work mat.
  boxes.push({ c: [0, -0.03, (BACK_Z + FRONT_Z) / 2], s: [width, 0.04, FRONT_Z - BACK_Z], color: C.floor });
  boxes.push({ c: [0, -0.0075, -0.1], s: [2.0, 0.005, 1.6], color: C.mat });

  // Walls: back + two sides, open toward the player.
  boxes.push({ c: [0, WALL_H / 2, BACK_Z - 0.05], s: [width + 0.2, WALL_H, 0.1], color: C.wall });
  for (const sx of [-1, 1]) {
    boxes.push({ c: [sx * (HALF_W + 0.05), WALL_H / 2, sideZ], s: [0.1, WALL_H, sideLen], color: C.wall });
    // skirting + accent stripe on the side walls
    boxes.push({ c: [sx * (HALF_W - 0.01), 0.06, sideZ], s: [0.02, 0.12, sideLen], color: C.skirting });
    boxes.push({ c: [sx * (HALF_W - 0.01), 1.05, sideZ], s: [0.02, 0.06, sideLen], color: C.stripe });
  }
  boxes.push({ c: [0, 0.06, BACK_Z + 0.01], s: [width, 0.12, 0.02], color: C.skirting });
  boxes.push({ c: [0, 1.05, BACK_Z + 0.01], s: [width, 0.06, 0.02], color: C.stripe });

  // Window on the back wall (self-lit), with a frame sill.
  boxes.push({ c: [1.5, 1.65, BACK_Z + 0.015], s: [1.4, 0.7, 0.01], color: C.window, group: 1 });
  boxes.push({ c: [1.5, 1.28, BACK_Z + 0.04], s: [1.5, 0.04, 0.08], color: C.skirting });

  // Bench 1: along the left wall. Bench 2: along the back wall, right side.
  bench(boxes, -HALF_W, -HALF_W + 0.7, -1.6, 0.2);
  bench(boxes, 0.8, 2.4, BACK_Z, BACK_Z + 0.7);

  // Things on the benches: parts trays, a screen block, a toolbox.
  boxes.push({ c: [-2.3, 0.9, -1.2], s: [0.3, 0.1, 0.4], color: 0x3a7bd5 });
  boxes.push({ c: [-2.3, 0.88, -0.6], s: [0.25, 0.06, 0.3], color: 0xe0a030 });
  boxes.push({ c: [-2.45, 1.05, -0.05], s: [0.05, 0.36, 0.5], color: 0x9aa3ad });
  boxes.push({ c: [1.2, 0.93, BACK_Z + 0.35], s: [0.45, 0.16, 0.25], color: 0xc23b33 });
  boxes.push({ c: [1.8, 0.89, BACK_Z + 0.3], s: [0.3, 0.08, 0.3], color: 0x4caf50 });
  boxes.push({ c: [2.2, 0.95, BACK_Z + 0.25], s: [0.15, 0.2, 0.15], color: 0xf2f2f2 });

  // Shelves on the back wall, left side: two uprights, four boards, boxes on them.
  const sx0 = -1.7;
  const sx1 = -0.4;
  const sz = BACK_Z + 0.18;
  for (const x of [sx0, sx1]) boxes.push({ c: [x, 0.95, sz], s: [0.04, 1.9, 0.34], color: C.shelf });
  const boardYs = [0.12, 0.6, 1.08, 1.56];
  for (const y of boardYs) boxes.push({ c: [(sx0 + sx1) / 2, y, sz], s: [sx1 - sx0, 0.03, 0.34], color: C.shelf });
  const partColors = [0x3a7bd5, 0xe0a030, 0x4caf50, 0xc23b33, 0x8e5bd0, 0x2b9bb0];
  let k = 0;
  for (let b = 0; b < boardYs.length; b++) {
    for (let i = 0; i < 3; i++) {
      const w = 0.22 + ((b + i) % 3) * 0.04;
      const h = 0.12 + ((b * 2 + i) % 3) * 0.06;
      const x = sx0 + 0.25 + i * 0.4;
      boxes.push({ c: [x, boardYs[b] + 0.015 + h / 2, sz], s: [w, h, 0.24], color: partColors[k++ % partColors.length] });
    }
  }

  // Ceiling light panels (self-lit), only seen from inside the room (XR virtual lab).
  for (const z of [-1.5, -0.2]) {
    boxes.push({ c: [0, WALL_H - 0.03, z], s: [1.2, 0.03, 0.3], color: C.light, group: 1 });
  }
  return boxes;
}

/** sRGB 0..1 channel to linear (three.js vertex colours are linear). */
export function srgbToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

// Face table for a unit box: normal + 4 corner signs (counter-clockwise seen from outside).
const FACES: ReadonlyArray<{ n: [number, number, number]; v: ReadonlyArray<[number, number, number]> }> = [
  { n: [1, 0, 0], v: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
  { n: [-1, 0, 0], v: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
  { n: [0, 1, 0], v: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
  { n: [0, -1, 0], v: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
  { n: [0, 0, 1], v: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { n: [0, 0, -1], v: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
];

export const VERTS_PER_BOX = 24;
export const INDICES_PER_BOX = 36;

/** Packs boxes into one indexed vertex buffer (one draw call per call of this). */
export function mergeBoxes(boxes: readonly RoomBox[]): MergedBoxes {
  const n = boxes.length;
  const position = new Float32Array(n * VERTS_PER_BOX * 3);
  const normal = new Float32Array(n * VERTS_PER_BOX * 3);
  const color = new Float32Array(n * VERTS_PER_BOX * 3);
  const index = new Uint32Array(n * INDICES_PER_BOX);
  let v = 0;
  let ix = 0;
  for (const box of boxes) {
    const r = srgbToLinear(((box.color >> 16) & 0xff) / 255);
    const g = srgbToLinear(((box.color >> 8) & 0xff) / 255);
    const b = srgbToLinear((box.color & 0xff) / 255);
    for (const face of FACES) {
      const base = v;
      for (const corner of face.v) {
        position[v * 3] = box.c[0] + (corner[0] * box.s[0]) / 2;
        position[v * 3 + 1] = box.c[1] + (corner[1] * box.s[1]) / 2;
        position[v * 3 + 2] = box.c[2] + (corner[2] * box.s[2]) / 2;
        normal.set(face.n, v * 3);
        color[v * 3] = r;
        color[v * 3 + 1] = g;
        color[v * 3 + 2] = b;
        v++;
      }
      index.set([base, base + 1, base + 2, base, base + 2, base + 3], ix);
      ix += 6;
    }
  }
  return { position, normal, color, index, boxCount: n };
}

/** Splits the room into its material groups: [lit, self-lit]. */
export function splitByGroup(boxes: readonly RoomBox[]): [RoomBox[], RoomBox[]] {
  const lit: RoomBox[] = [];
  const glow: RoomBox[] = [];
  for (const b of boxes) (b.group === 1 ? glow : lit).push(b);
  return [lit, glow];
}

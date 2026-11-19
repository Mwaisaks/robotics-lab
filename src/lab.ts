import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Entity,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OneHandGrabbable,
  RingGeometry,
  PhysicsBody,
  PhysicsShape,
  PhysicsShapeType,
  PhysicsState,
  World,
} from '@iwsdk/core';
import { Bin, Part } from './lab-components.js';
import { ArmRig, createArm } from './robot-arm.js';

/** Play-area size (meters). */
export const TABLE = {
  width: 0.9,
  depth: 0.5,
  thickness: 0.03,
};

/**
 * Where the play area sits: center of the table top (x, topY, z) and a yaw.
 * Yaw 0 means the player sits on +Z looking toward -Z. Default = fixed seated
 * spot in front of the XR origin; TablePlacementSystem may move it onto a real table.
 */
export const LAYOUT = { x: 0, topY: 0.72, z: -0.5, yaw: 0 };
export const DEFAULT_LAYOUT = { ...LAYOUT };

/** Local (table-relative) positions. +Z is toward the player. */
const PART_ROW_Z = 0.12;
const BIN_ROW_Z = -0.12;
export const SLOT_X = [-0.25, 0, 0.25];
/** Game panel: above the table center, just below seated eye height, tilted up. */
const PANEL_LOCAL_Y = 0.32;
const PANEL_TILT = (-15 * Math.PI) / 180;

/** One palette: red, blue, yellow on a dark slate table. */
export const PALETTE = [0xe5484d, 0x3e8ef7, 0xf5c542];
const COLOR_NAMES = ['Red', 'Blue', 'Yellow'];
const TABLE_COLOR = 0x2a2f3a;

type PartSpec = {
  geometry: BoxGeometry | CylinderGeometry;
  height: number;
  shape: (typeof PhysicsShapeType)[keyof typeof PhysicsShapeType];
  dimensions: [number, number, number];
};

const PARTS: PartSpec[] = [
  {
    geometry: new BoxGeometry(0.06, 0.06, 0.06),
    height: 0.06,
    shape: PhysicsShapeType.Box,
    dimensions: [0.06, 0.06, 0.06],
  },
  {
    geometry: new CylinderGeometry(0.032, 0.032, 0.07, 24),
    height: 0.07,
    shape: PhysicsShapeType.Cylinder,
    dimensions: [0.032, 0.07, 0],
  },
  {
    geometry: new CylinderGeometry(0.036, 0.036, 0.05, 6),
    height: 0.05,
    shape: PhysicsShapeType.Cylinder,
    dimensions: [0.036, 0.05, 0],
  },
];

const tableGeometry = new BoxGeometry(TABLE.width, TABLE.thickness, TABLE.depth);
const tableMaterial = new MeshStandardMaterial({ color: TABLE_COLOR, roughness: 0.85 });
const binGeometry = new BoxGeometry(0.18, 0.004, 0.16);
/**
 * Shape outline on each bin = footprint of its matching part, so the bin can be
 * read by shape as well as color: square (cube), circle (cylinder), hexagon (hex prism).
 * Flat rings lying on the bin plate; one shared white material.
 */
const outlineMaterial = new MeshBasicMaterial({ color: 0xffffff });
const OUTLINES = [
  new RingGeometry(0.046, 0.056, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2),
  new RingGeometry(0.038, 0.047, 32).rotateX(-Math.PI / 2),
  new RingGeometry(0.041, 0.051, 6).rotateX(-Math.PI / 2),
];
const binMaterials = PALETTE.map(
  (color) => new MeshStandardMaterial({ color, roughness: 0.9 }),
);
const partMaterials = PALETTE.map(
  (color) => new MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.1 }),
);

const FLASH_GREEN = new Color(0x3ddc84);
const binBase = PALETTE.map((c) => new Color(c));
/** Bin success flash: amount 1 = fully green, 0 = its own color. */
export function setBinFlash(slot: number, amount: number): void {
  binMaterials[slot].color.copy(binBase[slot]).lerp(FLASH_GREEN, amount);
}

/** Hint glow: pulse a part's own color as emissive (0 = off). Shared material per slot. */
export function setPartGlow(slot: number, intensity: number): void {
  const m = partMaterials[slot];
  if (intensity > 0 && m.emissive.getHex() !== PALETTE[slot]) m.emissive.setHex(PALETTE[slot]);
  m.emissiveIntensity = intensity;
  if (intensity <= 0) m.emissive.setHex(0x000000);
}

/** Table-local point -> world, written into `out`. */
export function toWorld(
  lx: number,
  ly: number,
  lz: number,
  out: [number, number, number],
): [number, number, number] {
  const c = Math.cos(LAYOUT.yaw);
  const s = Math.sin(LAYOUT.yaw);
  out[0] = LAYOUT.x + lx * c + lz * s;
  out[1] = LAYOUT.topY + ly;
  out[2] = LAYOUT.z - lx * s + lz * c;
  return out;
}

/** Rest height of a part above the table top. */
export function partRestY(slot: number): number {
  return PARTS[slot].height / 2 + 0.005;
}

/** Home spot of the part in `slot`, placed at column `column`. */
export function partHome(
  slot: number,
  column: number,
  out: [number, number, number],
): [number, number, number] {
  return toWorld(SLOT_X[column], partRestY(slot), PART_ROW_Z, out);
}

/** Robot arm base: front-right corner, beside the player's right hand, in front of the panel. */
const ARM_BASE_LOCAL = { x: 0.42, z: 0.19 };
let armRig: ArmRig | undefined;
export function getArmRig(): ArmRig | undefined {
  return armRig;
}
/** Set by GameSystem on a correct placement (seconds, performance.now() clock). */
export const ARM_SIGNAL = { celebrateUntil: 0 };

/** 'sort' = Level 1 (bins + parts); 'program' = Level 2 (mat + arm only; ProgramSystem adds its grid). */
export type LabMode = 'sort' | 'program';
export let LAB_MODE: LabMode = 'sort';

const labEntities: Entity[] = [];
const tmp: [number, number, number] = [0, 0, 0];

/** Builds the tabletop, 3 bins and 3 grabbable parts at LAYOUT. */
export function buildLab(world: World): void {
  // Table: static collider so parts rest on it.
  const table = new Mesh(tableGeometry, tableMaterial);
  table.position.set(...toWorld(0, -TABLE.thickness / 2, 0, tmp));
  table.rotation.y = LAYOUT.yaw;
  table.name = 'Lab Table';
  table.receiveShadow = true;
  labEntities.push(
    world
      .createTransformEntity(table)
      .addComponent(PhysicsShape, {
        shape: PhysicsShapeType.Box,
        dimensions: [TABLE.width, TABLE.thickness, TABLE.depth],
        friction: 0.8,
      })
      .addComponent(PhysicsBody, { state: PhysicsState.Static }),
  );

  // Bins: flat colored zones (visual only; parts rest on the table collider).
  if (LAB_MODE === 'sort') SLOT_X.forEach((x, slot) => {
    const bin = new Mesh(binGeometry, binMaterials[slot]);
    bin.position.set(...toWorld(x, 0.002, BIN_ROW_Z, tmp));
    bin.rotation.y = LAYOUT.yaw;
    bin.name = `${COLOR_NAMES[slot]} Bin`;
    bin.receiveShadow = true;
    const outline = new Mesh(OUTLINES[slot], outlineMaterial);
    outline.position.y = 0.0025; // just above the bin plate's top face
    bin.add(outline);
    labEntities.push(world.createTransformEntity(bin).addComponent(Bin, { slot }));
  });

  // Parts: dynamic bodies, grabbed by hand pinch (OneHandGrabbable).
  if (LAB_MODE === 'sort') PARTS.forEach((spec, slot) => {
    const part = new Mesh(spec.geometry, partMaterials[slot]);
    const home = partHome(slot, slot, [0, 0, 0]);
    part.position.set(...home);
    part.rotation.y = LAYOUT.yaw;
    part.name = `${COLOR_NAMES[slot]} Part`;
    part.castShadow = true;
    labEntities.push(
      world
        .createTransformEntity(part)
        .addComponent(Part, { slot, home })
        .addComponent(PhysicsShape, {
          shape: spec.shape,
          dimensions: spec.dimensions,
          friction: 0.8,
          restitution: 0.05,
        })
        .addComponent(PhysicsBody, { state: PhysicsState.Dynamic })
        .addComponent(OneHandGrabbable, {}),
    );
  });

  // Robot arm (visual only, no collider).
  armRig = createArm();
  armRig.root.position.set(...toWorld(ARM_BASE_LOCAL.x, 0, ARM_BASE_LOCAL.z, tmp));
  armRig.root.rotation.y = LAYOUT.yaw;
  labEntities.push(world.createTransformEntity(armRig.root));

  placeGamePanel(world);
}

/** Keeps the scene-authored game panel above the table center, facing the player. */
export function placeGamePanel(world: World): void {
  const panel = world.getSceneEntity('game-panel')?.object3D;
  if (panel == null) return;
  // Level 2 needs the mat's front half for its grid: panel goes higher and further back.
  const back = LAB_MODE === 'program';
  panel.position.set(...toWorld(0, back ? 0.4 : PANEL_LOCAL_Y, back ? -0.2 : 0, tmp));
  panel.rotation.set(PANEL_TILT, LAYOUT.yaw, 0, 'YXZ');
}

/** Switch Level 1 / Level 2 contents on the same mat (rebuilds only if it changes). */
export function setLabMode(world: World, mode: LabMode): void {
  if (mode === LAB_MODE) return;
  LAB_MODE = mode;
  relocateLab(world, { ...LAYOUT });
}

/** Moves the whole play area: dispose the old entities and rebuild at `next`. */
export function relocateLab(
  world: World,
  next: { x: number; topY: number; z: number; yaw: number },
): void {
  for (const entity of labEntities) entity.dispose();
  labEntities.length = 0;
  Object.assign(LAYOUT, next);
  buildLab(world);
}

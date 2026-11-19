import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from '@iwsdk/core';

/**
 * A small, friendly procedural robot arm: base, turret (yaw), shoulder (pitch),
 * upper arm, elbow (pitch), forearm and a two-finger gripper. The arm extends
 * along the turret's local -Z. Low-poly, shared geometry, no textures.
 *
 * Reach default (no docs/rules.md yet; Mike and Joshua can change it):
 * UPPER_ARM + FOREARM = 0.48 m from the shoulder.
 */
export const ARM = {
  baseHeight: 0.05,
  shoulderHeight: 0.09, // above the table top
  upperArm: 0.25,
  forearm: 0.23,
};
export const ARM_REACH = ARM.upperArm + ARM.forearm;

const WHITE = 0xf3f1ec;
const ORANGE = 0xf08a24;
const DARK = 0x30343c;
const OK_COLOR = 0xf3f1ec;
export const OUT_OF_REACH_COLOR = 0xe5484d;

const whiteMat = new MeshStandardMaterial({ color: WHITE, roughness: 0.5 });
const orangeMat = new MeshStandardMaterial({ color: ORANGE, roughness: 0.45 });
const darkMat = new MeshStandardMaterial({ color: DARK, roughness: 0.7 });
const eyeMat = new MeshStandardMaterial({
  color: 0x9be7ff,
  emissive: 0x4fc3f7,
  emissiveIntensity: 1.2,
});

const baseGeo = new CylinderGeometry(0.06, 0.07, ARM.baseHeight, 20);
const turretGeo = new CylinderGeometry(0.045, 0.05, 0.05, 20);
const jointGeo = new SphereGeometry(0.035, 16, 10);
const smallJointGeo = new SphereGeometry(0.028, 16, 10);
const eyeGeo = new SphereGeometry(0.008, 8, 6);
const upperGeo = new CylinderGeometry(0.022, 0.026, ARM.upperArm, 14).rotateX(Math.PI / 2).translate(0, 0, -ARM.upperArm / 2);
const foreGeo = new CylinderGeometry(0.018, 0.021, ARM.forearm, 14).rotateX(Math.PI / 2).translate(0, 0, -ARM.forearm / 2);
const palmGeo = new BoxGeometry(0.075, 0.018, 0.022);
const fingerGeo = new BoxGeometry(0.012, 0.016, 0.05).translate(0, 0, -0.025);
/** Finger x offset from the wrist centre: open vs closed (visible travel ~4 cm in total). */
export const GRIP_OPEN = 0.028;
export const GRIP_CLOSED = 0.008;

export type ArmRig = {
  root: Group;
  turret: Group;
  shoulder: Group;
  elbow: Group;
  fingerL: Mesh;
  fingerR: Mesh;
  /** Own material so only this arm's forearm turns red. */
  forearmMat: MeshStandardMaterial;
};

export function createArm(): ArmRig {
  const root = new Group();
  root.name = 'Robot Arm';

  const base = new Mesh(baseGeo, darkMat);
  base.position.y = ARM.baseHeight / 2;
  base.castShadow = false; // arm casts no shadow (saves shadow-map draw calls)
  root.add(base);

  const turret = new Group();
  turret.position.y = ARM.baseHeight;
  root.add(turret);
  const turretBody = new Mesh(turretGeo, whiteMat);
  turretBody.position.y = 0.025;
  turretBody.castShadow = false; // arm casts no shadow (saves shadow-map draw calls)
  turret.add(turretBody);
  // Two little "eyes" on the turret, facing where the arm points: friendly, not scary.
  for (const x of [-0.016, 0.016]) {
    const eye = new Mesh(eyeGeo, eyeMat);
    eye.position.set(x, 0.03, -0.047);
    turret.add(eye);
  }

  const shoulder = new Group();
  shoulder.position.y = ARM.shoulderHeight - ARM.baseHeight;
  turret.add(shoulder);
  const shoulderBall = new Mesh(jointGeo, orangeMat);
  shoulderBall.castShadow = false; // arm casts no shadow (saves shadow-map draw calls)
  shoulder.add(shoulderBall);
  const upper = new Mesh(upperGeo, whiteMat);
  upper.castShadow = false; // arm casts no shadow (saves shadow-map draw calls)
  shoulder.add(upper);

  const elbow = new Group();
  elbow.position.z = -ARM.upperArm;
  shoulder.add(elbow);
  const elbowBall = new Mesh(smallJointGeo, orangeMat);
  elbowBall.castShadow = false; // arm casts no shadow (saves shadow-map draw calls)
  elbow.add(elbowBall);
  const forearmMat = new MeshStandardMaterial({ color: OK_COLOR, roughness: 0.5 });
  const fore = new Mesh(foreGeo, forearmMat);
  fore.castShadow = false; // arm casts no shadow (saves shadow-map draw calls)
  elbow.add(fore);

  const wrist = new Group();
  wrist.position.z = -ARM.forearm;
  elbow.add(wrist);
  const palm = new Mesh(palmGeo, orangeMat);
  wrist.add(palm);
  const fingerL = new Mesh(fingerGeo, darkMat);
  const fingerR = new Mesh(fingerGeo, darkMat);
  fingerL.position.set(-GRIP_OPEN, 0, -0.01);
  fingerR.position.set(GRIP_OPEN, 0, -0.01);
  wrist.add(fingerL, fingerR);

  return { root, turret, shoulder, elbow, fingerL, fingerR, forearmMat };
}

export function setForearmOutOfReach(rig: ArmRig, out: boolean): void {
  rig.forearmMat.color.setHex(out ? OUT_OF_REACH_COLOR : OK_COLOR);
  rig.forearmMat.emissive.setHex(out ? 0x5a0d10 : 0x000000);
}

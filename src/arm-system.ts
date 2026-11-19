import { createSystem, Grabbed, Vector3 } from '@iwsdk/core';
import { Part } from './lab-components.js';
import { ARM_SIGNAL, getArmRig } from './lab.js';
import { MISTAKE } from './core/events.js';
import { learning } from './learning.js';
import { WEB } from './web/state.js';
import { ARM, ARM_REACH, GRIP_CLOSED, GRIP_OPEN, setForearmOutOfReach } from './robot-arm.js';

/**
 * Step 4, Version A: while a part is held, the arm turns and reaches toward it
 * (2-link IK in the turret's vertical plane). If the part is beyond ARM_REACH,
 * the arm stretches as far as it can and the forearm turns red.
 * Idle: a gentle "breathing" pose looking over the table.
 * Correct placement: a short happy wiggle (ARM_SIGNAL.celebrate).
 */
const FOLLOW = 8; // higher = snappier joint smoothing
const IDLE_TARGET = { x: -0.22, y: 0.16, z: -0.22 }; // arm-local: over the table, away from the player

export class ArmSystem extends createSystem({
  held: { required: [Part, Grabbed] },
}) {
  private target = new Vector3();
  private local = new Vector3();
  private yaw = 0;
  private shoulderPitch = 0.6;
  private elbowPitch = -1.2;
  private grip = GRIP_OPEN;
  private wasOut = false;
  /** OUT_OF_REACH is reported once per grab, not every time the part crosses the limit. */
  private reachReported = false;
  private time = 0;

  update(delta: number): void {
    const rig = getArmRig();
    if (rig == null) return;
    this.time += delta;
    const k = 1 - Math.exp(-FOLLOW * delta);

    // Target in arm-local coordinates.
    let tracking = false;
    for (const part of this.queries.held.entities) {
      const obj = part.object3D;
      if (obj == null) continue;
      obj.getWorldPosition(this.target);
      this.local.copy(this.target);
      rig.root.worldToLocal(this.local);
      tracking = true;
      break;
    }
    // Browser mode: the part dragged with mouse/touch counts as held.
    const dragged = WEB.dragged?.hasComponent(Part) ? WEB.dragged.object3D : undefined;
    if (!tracking && dragged != null) {
      dragged.getWorldPosition(this.target);
      this.local.copy(this.target);
      rig.root.worldToLocal(this.local);
      tracking = true;
    }
    if (!tracking) {
      const breathe = Math.sin(this.time * 1.6) * 0.012;
      this.local.set(IDLE_TARGET.x, IDLE_TARGET.y + breathe, IDLE_TARGET.z);
    }

    // Turret yaw: local -Z points at the target.
    let goalYaw = Math.atan2(-this.local.x, -this.local.z);
    // Celebration wiggle.
    const celebrating = performance.now() / 1000 < ARM_SIGNAL.celebrateUntil;
    if (celebrating) goalYaw += Math.sin(this.time * 18) * 0.35;

    // 2-link IK in the vertical plane through the shoulder.
    const r = Math.hypot(this.local.x, this.local.z);
    const y = this.local.y - ARM.shoulderHeight;
    const dist = Math.hypot(r, y);
    const out = tracking && dist > ARM_REACH;
    const d = Math.min(Math.max(dist, 0.06), ARM_REACH - 0.001);
    const L1 = ARM.upperArm;
    const L2 = ARM.forearm;
    const phi = Math.atan2(y, r);
    const beta = Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
    const gamma = Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2))));
    let goalShoulder = phi + beta; // elbow-up
    const goalElbow = -(Math.PI - gamma);
    if (celebrating) goalShoulder += 0.25;

    // Smooth, character-like motion.
    let dy = goalYaw - this.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * k;
    this.shoulderPitch += (goalShoulder - this.shoulderPitch) * k;
    this.elbowPitch += (goalElbow - this.elbowPitch) * k;
    rig.turret.rotation.y = this.yaw;
    rig.shoulder.rotation.x = this.shoulderPitch;
    rig.elbow.rotation.x = this.elbowPitch;

    // Gripper closes while tracking a held part.
    const goalGrip = tracking ? GRIP_CLOSED : GRIP_OPEN;
    this.grip += (goalGrip - this.grip) * k;
    rig.fingerL.position.x = -this.grip;
    rig.fingerR.position.x = this.grip;

    if (!tracking) this.reachReported = false;
    if (out && !this.reachReported) {
      this.reachReported = true;
      learning.mistake('sort', MISTAKE.OUT_OF_REACH);
    }

    if (out !== this.wasOut) {
      setForearmOutOfReach(rig, out);
      this.wasOut = out;
    }
  }
}

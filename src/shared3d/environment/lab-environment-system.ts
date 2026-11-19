import { createSystem, Object3D, VisibilityState } from '@iwsdk/core';
import { LAYOUT } from '../../lab.js';
import { createLabRoom } from './lab-room.js';
import { shouldShowRoom } from './settings.js';

/**
 * Shows the procedural lab room (src/shared3d/environment/lab-room.ts):
 * - flat page (VisibilityState.NonImmersive): always, so browser mode has a room
 *   instead of a blank page;
 * - headset session: never (the "Virtual lab" toggle is hidden for the demo), so AR
 *   passthrough stays visible.
 * The room follows the play table (LAYOUT x/z/yaw) in case table placement moved it.
 * update() only compares numbers and flips flags: no per-frame allocation.
 */
export class LabEnvironmentSystem extends createSystem({}) {
  private room!: Object3D;
  private placedX = Number.NaN;
  private placedZ = Number.NaN;
  private placedYaw = Number.NaN;

  init(): void {
    this.room = createLabRoom();
    this.room.visible = false;
    this.world.createTransformEntity(this.room);
  }

  update(): void {
    const show = shouldShowRoom(
      this.world.visibilityState.peek() === VisibilityState.NonImmersive,
      false, // Virtual lab in XR is off for the demo (toggle hidden)
    );
    if (this.room.visible !== show) this.room.visible = show;
    if (!show) return;
    if (LAYOUT.x !== this.placedX || LAYOUT.z !== this.placedZ || LAYOUT.yaw !== this.placedYaw) {
      this.placedX = LAYOUT.x;
      this.placedZ = LAYOUT.z;
      this.placedYaw = LAYOUT.yaw;
      this.room.position.set(LAYOUT.x, 0, LAYOUT.z);
      this.room.rotation.set(0, LAYOUT.yaw, 0);
    }
  }
}

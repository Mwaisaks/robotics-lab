import { createSystem, Grabbed, PhysicsSystem } from '@iwsdk/core';
import { Part } from './lab-components.js';
import { LAYOUT } from './lab.js';

const IDENTITY: [number, number, number, number] = [0, 0, 0, 1];
const MAX_DISTANCE = 1.2; // metres from the play-area centre

/**
 * If a released part falls off the table, or is thrown up or away, put it back
 * at its home spot. Uses PhysicsSystem.setBodyTransform so Havok and the
 * render transform stay in sync.
 */
export class PartRespawnSystem extends createSystem({
  loose: { required: [Part], excluded: [Grabbed] },
}) {
  private home: [number, number, number] = [0, 0, 0];

  update(): void {
    for (const entity of this.queries.loose.entities) {
      const obj = entity.object3D;
      if (obj == null) continue;
      // Back home if it fell below the table, or was thrown up or away (> MAX_DISTANCE).
      const dx = obj.position.x - LAYOUT.x;
      const dy = obj.position.y - LAYOUT.topY;
      const dz = obj.position.z - LAYOUT.z;
      const fell = dy < -0.25;
      const away = dx * dx + dy * dy + dz * dz > MAX_DISTANCE * MAX_DISTANCE;
      if (!fell && !away) continue;
      const h = entity.getVectorView(Part, 'home');
      this.home[0] = h[0];
      this.home[1] = h[1];
      this.home[2] = h[2];
      this.world
        .getSystem(PhysicsSystem)
        ?.setBodyTransform(entity, { position: this.home, quaternion: IDENTITY });
    }
  }
}

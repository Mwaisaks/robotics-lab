import { createSystem, UIKitMLAsset } from '@iwsdk/core';
import { toWorld } from './lab.js';

/**
 * Testing aid, off by default. With ?debug=1 in the URL, shows a small panel
 * above the game panel with FPS (averaged over 0.5 s), draw calls and the
 * build's short git commit hash. Without it, the panel stays hidden.
 */
export const DEBUG = new URLSearchParams(window.location.search).get('debug') === '1';
const SAMPLE_SECONDS = 0.5;

export class DebugSystem extends createSystem({}) {
  private ready = false;
  private frames = 0;
  private elapsed = 0;
  private pos: [number, number, number] = [0, 0, 0];

  update(delta: number): void {
    const entity = this.world.getSceneEntity('debug-panel');
    const panel = this.world.getSceneObject<UIKitMLAsset>('debug-panel');
    if (entity?.object3D == null || panel == null) return;
    if (!this.ready) {
      this.ready = true;
      entity.object3D.visible = DEBUG;
      panel.getElementById('build')?.setProperties({ text: `build ${__BUILD_HASH__}` });
      if (DEBUG) console.info(`[Debug] build ${__BUILD_HASH__}`);
    }
    if (!DEBUG) return;
    // Follow the play area: above the game panel, left side.
    entity.object3D.position.set(...toWorld(-0.12, 0.52, 0, this.pos));
    this.frames++;
    this.elapsed += delta;
    if (this.elapsed >= SAMPLE_SECONDS) {
      const fps = Math.round(this.frames / this.elapsed);
      const calls = this.world.renderer.info.render.calls;
      panel.getElementById('fps')?.setProperties({ text: `FPS ${fps}  calls ${calls}` });
      this.frames = 0;
      this.elapsed = 0;
    }
  }
}

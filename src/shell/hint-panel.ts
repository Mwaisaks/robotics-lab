import {
  CanvasTexture,
  createSystem,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Pressed,
  RayInteractable,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { toWorld } from '../lab.js';
import { RoboHintTap } from './hint-panel-components.js';
import { t } from './i18n.js';

/**
 * Robo's hint panel for HEADSET mode (the DOM hint box can't be seen in XR).
 * A single textured plane (1 draw call, 1024x320 texture) at the front-left of the
 * play area, about eye height, turned toward the player's head each time it shows.
 * Auto-hides after 6 s; a poke or pinch on it closes it; hidden when XR ends.
 */
export const HINT_PANEL = {
  /** Set by HintPanelSystem. Shows `text` (replacing any hint on screen). */
  show: (_text: string, _source: 'builtin' | 'ai'): void => undefined,
};

const AUTO_HIDE_S = 6;
const CANVAS_W = 1024;
const CANVAS_H = 320;
const PANEL_W = 0.34; // metres
const PANEL_H = PANEL_W * (CANVAS_H / CANVAS_W);
/** Table-local spot: front-left, near eye height for a seated player (head ~0.48 m above the table). */
const LOCAL: [number, number, number] = [-0.28, 0.4, 0.1];
const PAD = 36;
const MAX_LINES = 3;

export class HintPanelSystem extends createSystem({
  taps: { required: [RoboHintTap, Pressed] },
}) {
  private canvas = document.createElement('canvas');
  private texture = new CanvasTexture(this.canvas);
  private mesh = new Mesh(
    new PlaneGeometry(PANEL_W, PANEL_H),
    new MeshBasicMaterial({ map: this.texture, transparent: true, toneMapped: false }), // crisp, true colours
  );
  private hideIn = -1;
  private head = new Vector3();
  private tmp: [number, number, number] = [0, 0, 0];

  init(): void {
    this.canvas.width = CANVAS_W;
    this.canvas.height = CANVAS_H;
    this.mesh.name = 'Robo Hint';
    this.mesh.visible = false;
    const entity = this.world.createTransformEntity(this.mesh);
    entity.addComponent(RoboHintTap);
    entity.addComponent(RayInteractable);
    this.queries.taps.subscribe('qualify', () => this.hide());
    HINT_PANEL.show = (text, source) => this.show(text, source);
    this.cleanupFuncs.push(() => {
      HINT_PANEL.show = () => undefined;
    });
  }

  private show(text: string, source: 'builtin' | 'ai'): void {
    this.draw(text, source);
    toWorld(LOCAL[0], LOCAL[1], LOCAL[2], this.tmp);
    this.mesh.position.set(this.tmp[0], this.tmp[1], this.tmp[2]);
    this.player.head.getWorldPosition(this.head);
    this.mesh.lookAt(this.head);
    this.mesh.visible = true;
    this.hideIn = AUTO_HIDE_S;
  }

  private hide(): void {
    this.mesh.visible = false;
    this.hideIn = -1;
  }

  /** Cream card, amber border, "Robo" label, wrapped hint text (shrinks to fit 3 lines). */
  private draw(text: string, source: 'builtin' | 'ai'): void {
    const g = this.canvas.getContext('2d');
    if (g == null) return;
    g.clearRect(0, 0, CANVAS_W, CANVAS_H);
    g.fillStyle = '#FFF8DC';
    g.strokeStyle = '#F2A900';
    g.lineWidth = 10;
    g.beginPath();
    g.roundRect(5, 5, CANVAS_W - 10, CANVAS_H - 10, 36);
    g.fill();
    g.stroke();

    g.fillStyle = '#8A5A00';
    g.font = '800 34px system-ui, sans-serif';
    g.textBaseline = 'top';
    g.fillText(source === 'ai' ? `${t('robo.name')} ✦` : t('robo.name'), PAD, PAD - 6);
    g.font = '600 26px system-ui, sans-serif';
    g.textAlign = 'right';
    g.fillText(`✕ ${t('robo.close')}`, CANVAS_W - PAD, PAD - 2);
    g.textAlign = 'left';

    g.fillStyle = '#1A1A1A';
    let size = 46;
    let lines: string[] = [];
    for (; size >= 30; size -= 4) {
      g.font = `600 ${size}px system-ui, sans-serif`;
      lines = this.wrap(g, text, CANVAS_W - 2 * PAD);
      if (lines.length <= MAX_LINES) break;
    }
    const top = PAD + 48;
    lines.slice(0, MAX_LINES).forEach((line, i) => g.fillText(line, PAD, top + i * size * 1.22));
    this.texture.needsUpdate = true;
  }

  private wrap(g: CanvasRenderingContext2D, text: string, width: number): string[] {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (g.measureText(next).width > width && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  update(delta: number): void {
    if (!this.mesh.visible) return;
    if (this.world.visibilityState.peek() === VisibilityState.NonImmersive) {
      this.hide();
      return;
    }
    this.hideIn -= delta;
    if (this.hideIn < 0) this.hide();
  }
}

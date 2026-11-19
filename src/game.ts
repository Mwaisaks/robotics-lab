import {
  createSystem,
  Entity,
  Vector3,
  VisibilityState,
  GrabSystem,
  Grabbed,
  PhysicsBody,
  PhysicsSystem,
  UIKitMLAsset,
} from '@iwsdk/core';
import { Bin, GameState, Part } from './lab-components.js';
import { initSfx, playSfx } from './sfx.js';
import {
  NAV,
  PHASE_BUILD,
  PHASE_CIRCUIT,
  PHASE_MENU,
  PHASE_PLAYING,
  PHASE_PROGRAM,
  PHASE_TUTORIAL,
} from './nav.js';
import { WEB } from './web/state.js';
import { isLevelDone, markLevelDone } from './progress.js';
import { MISTAKE, type Stars } from './core/events.js';
import { sortStars } from './core/stars.js';
import { learning, modeOf } from './learning.js';
import {
  ARM_SIGNAL,
  LAYOUT,
  partHome,
  partRestY,
  placeGamePanel,
  relocateLab,
  setBinFlash,
  setLabMode,
  setPartGlow,
} from './lab.js';

/**
 * Round loop (default rules from docs/plan.md Step 3, until docs/rules.md exists):
 * Start -> Playing (60 s) -> Result -> Play again.
 * Part released in its matching bin: +10. Wrong bin: no points, part returns home.
 * When all three are sorted, parts reset to shuffled spots so the round keeps going.
 */
export const ROUND_SECONDS = 60;
const POINTS = 10;
const BIN_RADIUS = 0.085;
/** Forgiving placement: within this radius of its OWN bin a part snaps in (bins are 0.25 m apart). */
const SNAP_RADIUS = 0.13;
const REST_SPEED = 0.05;
const REFILL_DELAY = 0.7;
const FLASH_SECONDS = 0.7;
const FLASH_HOLD = 0.25; // full green before fading
const POP_SECONDS = 0.9;
const POP_SCALE = 0.09;
/** Pop sits in front of the bin (toward the player), below the game panel's sight line. */
const POP_TOWARD_PLAYER = 0.08;

/** Star thresholds (defaults; Mike and Joshua can change): 1 star for playing, 2 at 50, 3 at 90. */
export function starsFor(score: number): Stars {
  return sortStars(score);
}

/**
 * Fallback height: with no real table, the table top follows the player's head
 * at START / PLAY / AGAIN (seated head ~1.20 m -> 0.72 m, the default), so a
 * standing player doesn't have to bend. Real-table placement is never moved.
 */
const HEAD_TO_TABLE = 0.48;
const MIN_TABLE_TOP = 0.6;
const MAX_TABLE_TOP = 1.15;

const PHASE_START = 0;
const PHASE_RESULT = 2;

/**
 * How-to card (first START per XR session, or HOW TO PLAY): three icon steps and
 * a PLAY button (acts as skip). Parts reset and one glows as a hint meanwhile.
 * (Fallback chosen over an auto-advancing tutorial that could not be verified in time.)
 */

type UIElement = NonNullable<ReturnType<UIKitMLAsset['getElementById']>>;
const IDENTITY: [number, number, number, number] = [0, 0, 0, 1];

export class GameSystem extends createSystem({
  parts: { required: [Part] },
  bins: { required: [Bin] },
  held: { required: [Part, Grabbed] },
}) {
  private state!: Entity;
  private ui: Record<string, UIElement | undefined> = {};
  private uiReady = false;
  private scored = [false, false, false];
  private order = [0, 1, 2];
  private shownSeconds = -1;
  private refillIn = -1;
  private pos: [number, number, number] = [0, 0, 0];
  /** Timer waits for the first correct placement; until then one part glows as a hint. */
  private timerRunning = false;
  private hintSlot = -1;
  private time = 0;
  /** Feedback animations: bin flash and "+10" pop. */
  private flashSlot = -1;
  private flashT = 0;
  private popT = -1;
  private popPos: [number, number, number] = [0, 0, 0];
  /** How-to card shown once per XR session. */
  private tutorialDone = false;
  private headPos = new Vector3();

  init(): void {
    this.state = this.world.createTransformEntity();
    this.state.addComponent(GameState, { timeLeft: ROUND_SECONDS });
    initSfx(this.world);
    this.queries.held.subscribe('qualify', () => {
      playSfx('grab');
      learning.action('sort', 'grab_part');
    });
    // Tutorial runs on the first START of each XR session.
    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((state) => {
        if (state === VisibilityState.NonImmersive) this.tutorialDone = false;
      }),
    );
  }

  /** Panel may load after systems register; wire it on the first frame it exists. */
  private wireUI(): void {
    const panel = this.world.getSceneObject<UIKitMLAsset>('game-panel');
    if (panel == null) return;
    for (const id of [
      'start-view', 'play-view', 'result-view', 'start-button', 'again-button',
      'time-value', 'score-value', 'feedback', 'result-score', 'result-detail',
      'star-1', 'star-2', 'star-3',
      'howto-button', 'tutorial-view', 'skip-button',
      'menu-view', 'level1-button', 'level2-button', 'level3-button', 'exit-button-menu',
      'menu-button-start', 'menu-button-result', 'menu-button-play', 'next-level-button',
      'program-view', 'circuit-view', 'build-view', 'tick-1', 'tick-2', 'tick-3',
    ]) {
      this.ui[id] = panel.getElementById(id) ?? undefined;
    }
    // Buttons act on pointerdown as well as click: a fingertip poke sometimes misses
    // the click (down and up must land on the same element). Each handler only acts
    // in the phase where its button is visible, so the second event is ignored.
    const handlers: Record<string, () => void> = {
      'start-button': () => {
        if (this.phase() !== PHASE_START) return;
        if (this.tutorialDone) this.startRound();
        else this.startTutorial();
      },
      'howto-button': () => {
        if (this.phase() === PHASE_START) this.startTutorial();
      },
      'again-button': () => {
        if (this.phase() === PHASE_RESULT) this.startRound();
      },
      'level1-button': () => {
        if (this.phase() === PHASE_MENU) this.startLevel(1);
      },
      'level2-button': () => {
        if (this.phase() === PHASE_MENU) this.startLevel(2);
      },
      'level3-button': () => {
        if (this.phase() === PHASE_MENU) this.startLevel(3);
      },
      'next-level-button': () => {
        if (this.phase() === PHASE_RESULT) this.startLevel(2);
      },
      // Stops a Level 1 round (or the how-to card) cleanly and goes back to the menu.
      'menu-button-play': () => {
        const phase = this.phase();
        if (phase === PHASE_PLAYING || phase === PHASE_TUTORIAL) this.toMenu();
      },
      'menu-button-start': () => {
        if (this.phase() === PHASE_START) this.toMenu();
      },
      'menu-button-result': () => {
        if (this.phase() === PHASE_RESULT) this.toMenu();
      },
      'exit-button-menu': () => {
        if (this.phase() !== PHASE_MENU) return;
        if (WEB.active) NAV.exitToStart();
        else this.world.exitXR();
      },
      'skip-button': () => {
        if (this.phase() !== PHASE_TUTORIAL) return;
        this.tutorialDone = true;
        this.startRound();
      },
    };
    for (const [id, handler] of Object.entries(handlers)) {
      for (const type of ['click', 'pointerdown'] as const) {
        this.ui[id]?.addEventListener(type, handler);
        this.cleanupFuncs.push(() => this.ui[id]?.removeEventListener(type, handler));
      }
    }
    this.uiReady = true;
    NAV.toMenu = () => this.toMenu();
    NAV.startLevel = (level) => this.startLevel(level);
    placeGamePanel(this.world);
    const pop = this.world.getSceneEntity('pop-panel')?.object3D;
    if (pop) pop.visible = false;
    this.toMenu();
  }

  /** Opens a level from the menu or a NEXT LEVEL button. */
  startLevel(level: 1 | 2 | 3 | 4): void {
    const phase = this.phase();
    if (phase === PHASE_PROGRAM) NAV.stopProgram();
    if (phase === PHASE_CIRCUIT) NAV.stopCircuit();
    if (phase === PHASE_BUILD) NAV.stopBuild();
    this.stopRound();
    if (level === 1) {
      setLabMode(this.world, 'sort');
      this.state.setValue(GameState, 'phase', PHASE_START);
      this.showView(PHASE_START);
      return;
    }
    this.fitHeightToPlayer();
    setLabMode(this.world, 'program');
    const next = level === 2 ? PHASE_PROGRAM : level === 3 ? PHASE_CIRCUIT : PHASE_BUILD;
    this.state.setValue(GameState, 'phase', next);
    this.showView(next);
    if (level === 2) NAV.startProgram();
    else if (level === 3) NAV.startCircuit();
    else NAV.startBuild();
  }

  /** Ends any Level 1 round in progress: release held parts, stop the hint. */
  private stopRound(): void {
    if (learning.current === 'sort') learning.abandon();
    this.stopHint();
    this.refillIn = -1;
    this.timerRunning = false;
    const grab = this.world.getSystem(GrabSystem);
    for (const part of this.queries.parts.entities) {
      if (part.hasComponent(Grabbed)) grab?.forceRelease(part);
    }
  }

  /** Level menu (shown after Enter XR, and from MENU buttons). */
  toMenu(): void {
    const phase = this.phase();
    if (phase === PHASE_PROGRAM) NAV.stopProgram();
    if (phase === PHASE_CIRCUIT) NAV.stopCircuit();
    if (phase === PHASE_BUILD) NAV.stopBuild();
    this.stopRound();
    setLabMode(this.world, 'sort');
    this.state.setValue(GameState, 'phase', PHASE_MENU);
    this.showView(PHASE_MENU);
    for (const level of [1, 2, 3] as const) {
      this.ui[`tick-${level}`]?.setProperties({ display: isLevelDone(level) ? 'flex' : 'none' });
    }
  }

  private phase(): number {
    return this.state.getValue(GameState, 'phase') ?? PHASE_START;
  }

  private showView(phase: number): void {
    this.ui['start-view']?.setProperties({ display: phase === PHASE_START ? 'flex' : 'none' });
    this.ui['play-view']?.setProperties({ display: phase === PHASE_PLAYING ? 'flex' : 'none' });
    this.ui['result-view']?.setProperties({ display: phase === PHASE_RESULT ? 'flex' : 'none' });
    this.ui['tutorial-view']?.setProperties({ display: phase === PHASE_TUTORIAL ? 'flex' : 'none' });
    this.ui['menu-view']?.setProperties({ display: phase === PHASE_MENU ? 'flex' : 'none' });
    this.ui['program-view']?.setProperties({ display: phase === PHASE_PROGRAM ? 'flex' : 'none' });
    this.ui['circuit-view']?.setProperties({ display: phase === PHASE_CIRCUIT ? 'flex' : 'none' });
    this.ui['build-view']?.setProperties({ display: phase === PHASE_BUILD ? 'flex' : 'none' });
  }

  fitHeightToPlayer(): void {
    if ((this.state.getValue(GameState, 'placement') ?? 0) !== 0) return; // on a real table
    this.player.head.getWorldPosition(this.headPos);
    const top = Math.min(MAX_TABLE_TOP, Math.max(MIN_TABLE_TOP, this.headPos.y - HEAD_TO_TABLE));
    if (Math.abs(top - LAYOUT.topY) < 0.03) return;
    relocateLab(this.world, { x: LAYOUT.x, topY: top, z: LAYOUT.z, yaw: LAYOUT.yaw });
    console.info(`[Placement] fixed spot height set to ${top.toFixed(2)} m (head ${this.headPos.y.toFixed(2)} m)`);
  }

  startTutorial(): void {
    this.fitHeightToPlayer();
    this.state.setValue(GameState, 'phase', PHASE_TUTORIAL);
    this.state.setValue(GameState, 'timeLeft', ROUND_SECONDS);
    this.refillIn = -1;
    this.timerRunning = false;
    this.resetParts();
    this.startHint();
    this.showView(PHASE_TUTORIAL);
  }

  private setText(id: string, text: string): void {
    this.ui[id]?.setProperties({ text });
  }

  startRound(): void {
    if (this.phase() === PHASE_PLAYING) return;
    this.fitHeightToPlayer();
    this.stopHint();
    this.state.setValue(GameState, 'score', 0);
    this.state.setValue(GameState, 'sorted', 0);
    this.state.setValue(GameState, 'timeLeft', ROUND_SECONDS);
    this.state.setValue(GameState, 'phase', PHASE_PLAYING);
    this.shownSeconds = -1;
    this.refillIn = -1;
    this.resetParts();
    this.timerRunning = false;
    this.startHint();
    this.setText('time-value', String(ROUND_SECONDS));
    this.setText('score-value', '0');
    this.setText('feedback', 'Pinch the glowing part!');
    this.showView(PHASE_PLAYING);
    learning.start('sort', 0, modeOf(this.world));
  }

  /** Hint the part with the shortest move: one already in its bin's column, else the middle one. */
  private startHint(): void {
    this.stopHint();
    let slot = this.order.indexOf(1);
    for (let s = 0; s < this.order.length; s++) {
      if (this.order[s] === s) slot = s;
    }
    this.hintSlot = slot;
  }

  private stopHint(): void {
    if (this.hintSlot >= 0) setPartGlow(this.hintSlot, 0);
    this.hintSlot = -1;
  }

  private endRound(): void {
    this.stopHint();
    markLevelDone(1);
    playSfx('end');
    this.state.setValue(GameState, 'phase', PHASE_RESULT);
    this.state.setValue(GameState, 'timeLeft', 0);
    const grab = this.world.getSystem(GrabSystem);
    for (const part of this.queries.parts.entities) {
      if (part.hasComponent(Grabbed)) grab?.forceRelease(part);
    }
    const score = this.state.getValue(GameState, 'score') ?? 0;
    const sorted = this.state.getValue(GameState, 'sorted') ?? 0;
    this.setText('result-score', `Score: ${score}`);
    this.setText('result-detail', `${sorted} part${sorted === 1 ? '' : 's'} sorted`);
    const stars = starsFor(score);
    learning.complete('sort', stars);
    for (let i = 1; i <= 3; i++) {
      this.ui[`star-${i}`]?.setProperties({ color: i <= stars ? '#f5c542' : '#5a5d66' });
    }
    this.showView(PHASE_RESULT);
  }

  /** Put every part back on the front row, in a shuffled order. */
  private resetParts(): void {
    for (let i = this.order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.order[i], this.order[j]] = [this.order[j], this.order[i]];
    }
    const grab = this.world.getSystem(GrabSystem);
    for (const part of this.queries.parts.entities) {
      if (part.hasComponent(Grabbed)) grab?.forceRelease(part);
      const slot = part.getValue(Part, 'slot') ?? 0;
      const home = part.getVectorView(Part, 'home');
      partHome(slot, this.order[slot], this.pos);
      home[0] = this.pos[0];
      home[1] = this.pos[1];
      home[2] = this.pos[2];
      this.scored[slot] = false;
      this.sendHome(part);
    }
  }

  private sendHome(part: Entity): void {
    const home = part.getVectorView(Part, 'home');
    this.pos[0] = home[0];
    this.pos[1] = home[1];
    this.pos[2] = home[2];
    this.world
      .getSystem(PhysicsSystem)
      ?.setBodyTransform(part, { position: this.pos, quaternion: IDENTITY });
  }

  /**
   * Which bin a resting part counts as being in, or -1. Its own bin wins within
   * SNAP_RADIUS (forgiving); a wrong bin only within BIN_RADIUS (strict).
   * On a correct match, this.pos holds the bin's snap position.
   */
  private binUnder(part: Entity, slot: number): number {
    const p = part.object3D?.position;
    if (p == null || p.y > LAYOUT.topY + 0.08) return -1;
    const v = part.getVectorView(PhysicsBody, '_linearVelocity');
    if (v[0] * v[0] + v[1] * v[1] + v[2] * v[2] > REST_SPEED * REST_SPEED) return -1;
    let wrong = -1;
    for (const bin of this.queries.bins.entities) {
      const b = bin.object3D?.position;
      if (b == null) continue;
      const dx = p.x - b.x;
      const dz = p.z - b.z;
      const d2 = dx * dx + dz * dz;
      const binSlot = bin.getValue(Bin, 'slot') ?? -1;
      if (binSlot === slot && d2 < SNAP_RADIUS * SNAP_RADIUS) {
        this.pos[0] = b.x;
        this.pos[1] = LAYOUT.topY + partRestY(slot);
        this.pos[2] = b.z;
        return slot;
      }
      if (d2 < BIN_RADIUS * BIN_RADIUS) wrong = binSlot;
    }
    return wrong;
  }

  /** Bin flash + "+10" pop, animated every frame (cheap: one color lerp, one transform). */
  private animateFeedback(delta: number): void {
    if (this.flashSlot >= 0) {
      this.flashT += delta;
      const k = this.flashT < FLASH_HOLD ? 1 : Math.max(0, 1 - (this.flashT - FLASH_HOLD) / (FLASH_SECONDS - FLASH_HOLD));
      setBinFlash(this.flashSlot, k);
      if (k <= 0) this.flashSlot = -1;
    }
    if (this.popT >= 0) {
      const pop = this.world.getSceneEntity('pop-panel')?.object3D;
      this.popT += delta;
      const t = this.popT / POP_SECONDS;
      if (pop == null || t >= 1) {
        if (pop) pop.visible = false;
        this.popT = -1;
        return;
      }
      pop.visible = true;
      const sx = Math.sin(LAYOUT.yaw) * POP_TOWARD_PLAYER;
      const sz = Math.cos(LAYOUT.yaw) * POP_TOWARD_PLAYER;
      pop.position.set(this.popPos[0] + sx, this.popPos[1] + 0.02 + 0.05 * t, this.popPos[2] + sz);
      pop.rotation.set(-0.6, LAYOUT.yaw, 0, 'YXZ');
      pop.scale.setScalar(POP_SCALE * (t < 0.2 ? 0.5 + 2.5 * t : 1));
    }
  }

  private celebrate(slot: number): void {
    if (this.flashSlot >= 0) setBinFlash(this.flashSlot, 0);
    this.flashSlot = slot;
    this.flashT = 0;
    this.popPos[0] = this.pos[0];
    this.popPos[1] = this.pos[1];
    this.popPos[2] = this.pos[2];
    this.popT = 0;
  }

  update(delta: number): void {
    if (!this.uiReady) this.wireUI();
    this.animateFeedback(delta);
    const phase = this.phase();
    if (phase !== PHASE_PLAYING && phase !== PHASE_TUTORIAL) return;
    this.time += delta;

    // Gentle hint pulse until the first correct placement.
    if (this.hintSlot >= 0) {
      setPartGlow(this.hintSlot, 0.1 + 0.5 * (0.5 + 0.5 * Math.sin(this.time * 4)));
    }

    // How-to card: parts can be tried out (snap + sounds), no timer, no score.
    if (phase === PHASE_TUTORIAL) {
      this.checkPlacements(true);
      return;
    }

    // Timer (starts at the first correct placement)
    const step = this.timerRunning ? delta : 0;
    const timeLeft = Math.max(0, (this.state.getValue(GameState, 'timeLeft') ?? 0) - step);
    this.state.setValue(GameState, 'timeLeft', timeLeft);
    const seconds = Math.ceil(timeLeft);
    if (seconds !== this.shownSeconds) {
      this.shownSeconds = seconds;
      this.setText('time-value', String(seconds));
    }
    if (timeLeft <= 0) {
      this.endRound();
      return;
    }

    // All sorted: short pause, then a fresh shuffled set.
    if (this.refillIn >= 0) {
      this.refillIn -= delta;
      if (this.refillIn < 0) {
        this.resetParts();
        this.setText('feedback', 'New set!');
      }
      return;
    }

    this.checkPlacements(false);
  }

  /** Released parts: correct bin snaps in (+10 when playing), wrong bin goes home. */
  private checkPlacements(tutorial: boolean): void {
    for (const part of this.queries.parts.entities) {
      const slot = part.getValue(Part, 'slot') ?? 0;
      if (this.scored[slot] || part.hasComponent(Grabbed)) continue;
      const binSlot = this.binUnder(part, slot);
      if (binSlot < 0) continue;
      if (binSlot === slot) {
        this.scored[slot] = true;
        // Snap neatly into the bin center.
        this.world
          .getSystem(PhysicsSystem)
          ?.setBodyTransform(part, { position: this.pos, quaternion: IDENTITY });
        this.celebrate(slot);
        playSfx('correct');
        ARM_SIGNAL.celebrateUntil = performance.now() / 1000 + 0.9;
        if (tutorial) {
          this.stopHint();
          continue;
        }
        const score = (this.state.getValue(GameState, 'score') ?? 0) + POINTS;
        const sorted = (this.state.getValue(GameState, 'sorted') ?? 0) + 1;
        this.state.setValue(GameState, 'score', score);
        this.state.setValue(GameState, 'sorted', sorted);
        this.setText('score-value', String(score));
        this.setText('feedback', `+${POINTS} Correct!`);
        learning.action('sort', 'part_sorted');
        if (!this.timerRunning) {
          this.timerRunning = true;
          this.stopHint();
        }
        if (this.scored.every(Boolean)) this.refillIn = REFILL_DELAY;
      } else {
        if (!tutorial) this.setText('feedback', 'Wrong bin. Try again.');
        learning.mistake('sort', MISTAKE.WRONG_BIN, `part ${slot} in bin ${binSlot}`);
        playSfx('wrong');
        this.sendHome(part);
      }
    }
  }

}

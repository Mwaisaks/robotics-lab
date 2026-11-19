import {
  BoxGeometry,
  CanvasTexture,
  createSystem,
  CylinderGeometry,
  Entity,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  UIKitMLAsset,
} from '@iwsdk/core';
import { GameState } from './lab-components.js';
import { ARM_SIGNAL, LAYOUT, placeGamePanel, toWorld } from './lab.js';
import { NAV, PHASE_PROGRAM } from './nav.js';
import { markLevelDone } from './progress.js';
import { playSfx } from './sfx.js';
import { CHALLENGES, GRID_SIZE as GRID, MAX_BLOCKS } from './core/program/challenges.js';
import { programActivity, type Block, type ProgramState, type Step } from './core/program/program.js';
import { reportRun } from './core/program/report.js';
import { learning, modeOf } from './learning.js';

/**
 * Level 2, "Program the robot" (spec: docs/activities/program.md). The rules live in
 * src/core/program: this system turns presses into core inputs, animates the steps the
 * core returns over a 5x5 grid with obstacles, and reports each RUN with reportRun().
 * Blocks: FORWARD, BACK, LEFT, RIGHT, REPEAT n (press REPEAT again to cycle n = 2, 3, 4).
 */
type Cmd = 'fwd' | 'back' | 'left' | 'right' | 'rep';
const CMDS: Cmd[] = ['fwd', 'back', 'left', 'right', 'rep'];
const CMD_COLOR: Record<Cmd, string> = {
  fwd: '#2e9e5b',
  back: '#2a8c9c',
  left: '#3e6fd8',
  right: '#7c4fd0',
  rep: '#d9822b',
};
/** 5 tiles of 6 cm keep the baseline 4 x 7.5 cm footprint (front half of the mat, clear of the arm). */
const TILE = 0.06;
/** Grid corner in table-local metres. */
const GRID_X0 = -0.23;
const GRID_Z0 = -0.1;
const STEP_SECONDS = 0.45;
const MAX_OBSTACLES = Math.max(...CHALLENGES.map((c) => c.obstacles.length));

/** Directions (as in the core): 0 = away from the player (-Z), 1 = right (+X), 2 = toward player, 3 = left. */
const DIR_DC = [0, 1, 0, -1];
const DIR_DR = [-1, 0, 1, 0];

/**
 * On-screen text, max 5 words each. TODO(i18n): move to src/shell/i18n.ts (en + sw) once it exists.
 */
const TEXT = {
  challenge: [
    'Drive to the star',
    'Turn to reach the star',
    'Go around the block',
    'Long road? Try REPEAT!',
    'Use REPEAT around the wall',
  ],
  empty: 'Add blocks first.',
  wall: 'Bump! Edge of the grid.',
  obstacle: 'Bump! Square is blocked.',
  missed: 'Not there yet. Try again!',
  solved: 'You did it!',
  overPar: 'Solved! Fewer blocks?',
};

type UIElement = NonNullable<ReturnType<UIKitMLAsset['getElementById']>>;

const topMat = new MeshStandardMaterial({ color: 0xf08a24, roughness: 0.45 });
const obstacleMat = new MeshStandardMaterial({ color: 0x8d5a3b, roughness: 0.7 });
const obstacleGeo = new BoxGeometry(TILE * 0.8, 0.03, TILE * 0.8);
const wheelMat = new MeshStandardMaterial({ color: 0x30343c, roughness: 0.8 });
const eyeMat = new MeshStandardMaterial({ color: 0x9be7ff, emissive: 0x4fc3f7, emissiveIntensity: 1.2 });
const starMat = new MeshBasicMaterial({ color: 0xf5c542 });

function starGeometry(outer: number, inner: number): ShapeGeometry {
  const shape = new Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return new ShapeGeometry(shape).rotateX(-Math.PI / 2);
}

function gridTexture(): CanvasTexture {
  const size = 320;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  if (g) {
    const t = size / GRID;
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        g.fillStyle = (r + c) % 2 === 0 ? '#4a505c' : '#3c414b';
        g.fillRect(c * t, r * t, t, t);
      }
    }
    g.strokeStyle = '#c9ccd3';
    g.lineWidth = 4;
    g.strokeRect(2, 2, size - 4, size - 4);
  }
  return new CanvasTexture(canvas);
}

function uiCmd(block: Block | undefined): Cmd | undefined {
  if (!block) return undefined;
  return block.cmd === 'repeat' ? 'rep' : block.cmd;
}

export class ProgramSystem extends createSystem({
  game: { required: [GameState] },
}) {
  private ui: Record<string, UIElement | undefined> = {};
  private uiReady = false;
  private lastPress: Record<string, number> = {};
  /** Ignore presses until this time: the poke that opened the view must not add a block. */
  private readyAt = 0;
  private challenge = 0;
  /** Core state (blocks, tries, stars, last run). */
  private state: ProgramState = programActivity.init(0);
  private running = false;
  private steps: Step[] = [];
  private stepIndex = 0;
  private stepT = 0;
  /** Robot pose being animated: column, row, direction (0..3), and continuous yaw. */
  private col = 0;
  private row = 0;
  private dir = 0;
  private yaw = 0;
  private from = { x: 0, z: 0, yaw: 0 };
  private to = { x: 0, z: 0, yaw: 0 };
  private bumping = false;
  private flash = 0;
  private flashGreen = false;
  private finishIn = -1;
  private time = 0;
  // Scene objects (created on start, disposed on stop).
  private root?: Entity;
  private robot?: Group;
  private star?: Mesh;
  private obstacles: Mesh[] = [];
  private robotBody?: MeshStandardMaterial;

  init(): void {
    NAV.startProgram = () => this.start();
    NAV.stopProgram = () => this.stop();
  }

  private phase(): number {
    for (const e of this.queries.game.entities) return e.getValue(GameState, 'phase') ?? 0;
    return 0;
  }

  /**
   * Buttons act on pointerdown only: one event per poke or pinch (a poke also fires
   * click on release, which would add every block twice). Repeats within 0.35 s ignored.
   */
  private bind(id: string, fn: () => void): void {
    const handler = () => {
      if (this.phase() !== PHASE_PROGRAM) return;
      const now = performance.now();
      if (now < this.readyAt) return;
      if (now - (this.lastPress[id] ?? 0) < 350) return;
      this.lastPress[id] = now;
      fn();
    };
    this.ui[id]?.addEventListener('pointerdown', handler);
    this.cleanupFuncs.push(() => this.ui[id]?.removeEventListener('pointerdown', handler));
  }

  private wireUI(): boolean {
    if (this.uiReady) return true;
    const panel = this.world.getSceneObject<UIKitMLAsset>('game-panel');
    if (panel == null) return false;
    const ids = [
      'prog-title', 'prog-instr', 'prog-edit', 'prog-done', 'done-title', 'done-text',
      'next-button', 'next-label', 'menu-button-done', 'menu-button-prog', 'prog-undo', 'prog-clear', 'prog-run',
      ...CMDS.map((c) => `cmd-${c}`),
    ];
    for (let i = 0; i < MAX_BLOCKS; i++) {
      ids.push(`slot-${i}`, `slot-${i}-n`);
      for (const c of CMDS) ids.push(`slot-${i}-${c}`);
    }
    for (const id of ids) this.ui[id] = panel.getElementById(id) ?? undefined;
    for (const c of CMDS) this.bind(`cmd-${c}`, () => this.add(c));
    this.bind('prog-undo', () => {
      if (this.running) return;
      this.state = programActivity.apply(this.state, { type: 'remove' });
      this.renderProgram(-1);
      learning.action('program', 'undo');
    });
    this.bind('prog-clear', () => {
      if (this.running) return;
      this.state = programActivity.apply(this.state, { type: 'clear' });
      this.renderProgram(-1);
      this.placeRobotAtStart();
      learning.action('program', 'clear');
    });
    this.bind('prog-run', () => this.run());
    this.bind('next-button', () => {
      if (this.challenge < CHALLENGES.length - 1) this.loadChallenge(this.challenge + 1);
      else NAV.startLevel(3);
    });
    this.bind('menu-button-done', () => NAV.toMenu());
    this.bind('menu-button-prog', () => NAV.toMenu());
    this.uiReady = true;
    return true;
  }

  start(): void {
    this.wireUI();
    this.buildScene();
    placeGamePanel(this.world);
    this.loadChallenge(0);
  }

  stop(): void {
    if (learning.current === 'program') learning.abandon();
    this.running = false;
    this.root?.dispose();
    this.root = undefined;
    this.robot = undefined;
    this.star = undefined;
    this.obstacles = [];
  }

  private buildScene(): void {
    this.stop();
    const root = new Group();
    root.name = 'Program Grid';
    const tmp: [number, number, number] = [0, 0, 0];
    root.position.set(...toWorld(0, 0, 0, tmp));
    root.rotation.y = LAYOUT.yaw;

    const grid = new Mesh(
      new PlaneGeometry(GRID * TILE, GRID * TILE).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ map: gridTexture() }),
    );
    grid.position.set(GRID_X0 + (GRID * TILE) / 2, 0.003, GRID_Z0 + (GRID * TILE) / 2);
    root.add(grid);

    const star = new Mesh(starGeometry(0.025, 0.011), starMat);
    root.add(star);
    this.star = star;

    // Obstacles: one shared geometry + material; unused ones are hidden per challenge.
    for (let i = 0; i < MAX_OBSTACLES; i++) {
      const block = new Mesh(obstacleGeo, obstacleMat);
      block.visible = false;
      root.add(block);
      this.obstacles.push(block);
    }

    const robot = new Group();
    this.robotBody = new MeshStandardMaterial({ color: 0xf3f1ec, roughness: 0.5 });
    const body = new Mesh(new BoxGeometry(0.046, 0.026, 0.05), this.robotBody);
    body.position.y = 0.022;
    const top = new Mesh(new BoxGeometry(0.036, 0.008, 0.034), topMat);
    top.position.y = 0.039;
    robot.add(body, top);
    for (const x of [-0.027, 0.027]) {
      const wheel = new Mesh(new CylinderGeometry(0.013, 0.013, 0.008, 14).rotateZ(Math.PI / 2), wheelMat);
      wheel.position.set(x, 0.013, 0);
      robot.add(wheel);
    }
    // Front "eyes" show which way the robot faces (local -Z).
    for (const x of [-0.011, 0.011]) {
      const eye = new Mesh(new SphereGeometry(0.0055, 8, 6), eyeMat);
      eye.position.set(x, 0.026, -0.026);
      robot.add(eye);
    }
    robot.scale.setScalar(0.85); // fits a 6 cm tile
    root.add(robot);
    this.robot = robot;

    this.root = this.world.createTransformEntity(root);
  }

  private tileX(c: number): number {
    return GRID_X0 + (c + 0.5) * TILE;
  }

  private tileZ(r: number): number {
    return GRID_Z0 + (r + 0.5) * TILE;
  }

  private dirYaw(d: number): number {
    return -d * (Math.PI / 2);
  }

  private loadChallenge(i: number): void {
    this.challenge = i;
    this.readyAt = performance.now() + 600;
    const ch = CHALLENGES[i];
    this.state = programActivity.init(i);
    this.ui['prog-title']?.setProperties({ text: `CHALLENGE ${i + 1}/${CHALLENGES.length}` });
    this.ui['prog-instr']?.setProperties({ text: TEXT.challenge[i] });
    this.ui['prog-edit']?.setProperties({ display: 'flex' });
    this.ui['prog-done']?.setProperties({ display: 'none' });
    this.star?.position.set(this.tileX(ch.goal.col), 0.006, this.tileZ(ch.goal.row));
    this.obstacles.forEach((block, k) => {
      const cell = ch.obstacles[k];
      block.visible = cell !== undefined;
      if (cell) block.position.set(this.tileX(cell[0]), 0.018, this.tileZ(cell[1]));
    });
    this.renderProgram(-1);
    this.placeRobotAtStart();
    learning.start('program', i, modeOf(this.world));
  }

  private placeRobotAtStart(): void {
    const { col, row, dir } = CHALLENGES[this.challenge].start;
    this.col = col;
    this.row = row;
    this.dir = dir;
    this.yaw = this.dirYaw(dir);
    this.running = false;
    this.finishIn = -1;
    this.robot?.position.set(this.tileX(col), 0.004, this.tileZ(row));
    this.robot?.rotation.set(0, this.yaw, 0);
  }

  /** REPEAT right after REPEAT cycles its count 2 -> 3 -> 4 -> 2 instead of adding a block. */
  private add(c: Cmd): void {
    if (this.running) return;
    const blocks = this.state.blocks;
    const last = blocks[blocks.length - 1];
    let next: ProgramState;
    let name: string;
    if (c === 'rep' && last?.cmd === 'repeat') {
      const n = last.n === 4 ? 2 : ((last.n + 1) as 3 | 4);
      next = programActivity.apply(programActivity.apply(this.state, { type: 'remove' }), {
        type: 'add',
        block: { cmd: 'repeat', n },
      });
      name = `repeat_${n}`;
    } else {
      const block: Block = c === 'rep' ? { cmd: 'repeat', n: 2 } : { cmd: c };
      next = programActivity.apply(this.state, { type: 'add', block });
      name = c === 'rep' ? 'add_repeat' : `add_${c}`;
    }
    if (next === this.state) return; // full (8 blocks)
    this.state = next;
    playSfx('grab');
    learning.action('program', name);
    this.renderProgram(-1);
  }

  /** Program row: each slot shows its block's icon (or "xN" for REPEAT) on its colour; `active` is outlined. */
  private renderProgram(active: number): void {
    for (let i = 0; i < MAX_BLOCKS; i++) {
      const block = this.state.blocks[i];
      const cmd = uiCmd(block);
      for (const c of CMDS) {
        // REPEAT shows its count text instead of the icon (falls back to the icon if the panel lacks slot-N-n).
        const show = c === cmd && !(c === 'rep' && this.ui[`slot-${i}-n`]);
        this.ui[`slot-${i}-${c}`]?.setProperties({ display: show ? 'flex' : 'none' });
      }
      this.ui[`slot-${i}-n`]?.setProperties(
        block?.cmd === 'repeat' ? { display: 'flex', text: `x${block.n}` } : { display: 'none' },
      );
      this.ui[`slot-${i}`]?.setProperties({
        backgroundColor: cmd ? CMD_COLOR[cmd] : '#2b2e35',
        borderColor: i === active ? '#ffe066' : cmd ? CMD_COLOR[cmd] : '#3a3d45',
      });
    }
  }

  private run(): void {
    if (this.running || this.finishIn >= 0) return;
    this.state = programActivity.apply(this.state, { type: 'run' });
    const result = this.state.lastRun?.result;
    if (!result) {
      // Empty program: nothing to animate.
      this.ui['prog-instr']?.setProperties({ text: TEXT.empty });
      reportRun(learning, this.state);
      return;
    }
    this.placeRobotAtStart();
    this.steps = result.steps;
    this.stepIndex = -1;
    this.running = true;
    this.nextStep();
  }

  private nextStep(): void {
    this.stepIndex++;
    if (this.stepIndex >= this.steps.length) {
      this.finishRun();
      return;
    }
    const step = this.steps[this.stepIndex];
    this.renderProgram(step.block);
    this.from.x = this.tileX(this.col);
    this.from.z = this.tileZ(this.row);
    this.from.yaw = this.yaw;
    this.to.x = this.tileX(step.pose.col);
    this.to.z = this.tileZ(step.pose.row);
    this.to.yaw = this.yaw;
    this.bumping = step.bump !== undefined;
    if (step.cmd === 'left' || step.cmd === 'right') {
      this.to.yaw = this.yaw + (step.cmd === 'right' ? -1 : 1) * (Math.PI / 2);
    } else if (this.bumping) {
      // Edge or obstacle: nudge toward it a little and back, then stop.
      const sign = step.cmd === 'fwd' ? 1 : -1;
      this.to.x = this.from.x + sign * DIR_DC[this.dir] * TILE * 0.3;
      this.to.z = this.from.z + sign * DIR_DR[this.dir] * TILE * 0.3;
      playSfx('wrong');
      this.flash = 1;
      this.flashGreen = false;
    }
    this.stepT = 0;
  }

  /** Animation done: show the outcome, then send the run's events (so Robo's hint lands with the bump). */
  private finishRun(): void {
    this.running = false;
    this.renderProgram(-1);
    const run = this.state.lastRun;
    const outcome = run?.result?.outcome;
    if (outcome === 'solved') {
      playSfx('correct');
      this.flash = 1;
      this.flashGreen = true;
      ARM_SIGNAL.celebrateUntil = performance.now() / 1000 + 1.2;
      const overPar = run?.mistake?.code === 'TOO_MANY_BLOCKS';
      this.ui['prog-instr']?.setProperties({ text: overPar ? TEXT.overPar : TEXT.solved });
      this.finishIn = 1.0;
    } else {
      const text = outcome === 'HIT_WALL' ? TEXT.wall : outcome === 'HIT_OBSTACLE' ? TEXT.obstacle : TEXT.missed;
      this.ui['prog-instr']?.setProperties({ text });
    }
    reportRun(learning, this.state);
  }

  update(delta: number): void {
    if (this.phase() !== PHASE_PROGRAM || this.robot == null) return;
    this.time += delta;
    // Star: gentle spin and bob.
    if (this.star) {
      this.star.rotation.y = this.time * 1.2;
      this.star.position.y = 0.008 + Math.sin(this.time * 3) * 0.003;
    }
    // Bump (red) / success (green) flash on the robot body.
    if (this.flash > 0 && this.robotBody) {
      this.flash = Math.max(0, this.flash - delta * 1.5);
      const f = 0.7 * this.flash;
      if (this.flashGreen) this.robotBody.color.setRGB(0.95 - f, 0.95, 0.93 - f);
      else this.robotBody.color.setRGB(0.95, 0.95 - f, 0.93 - f);
    }
    if (this.finishIn >= 0) {
      this.finishIn -= delta;
      if (this.finishIn < 0) this.showDone();
      return;
    }
    if (!this.running) return;

    this.stepT += delta / STEP_SECONDS;
    const t = Math.min(1, this.stepT);
    const k = this.bumping ? Math.sin(Math.PI * t) : t * t * (3 - 2 * t);
    const x = this.from.x + (this.to.x - this.from.x) * k;
    const z = this.from.z + (this.to.z - this.from.z) * k;
    this.robot.position.set(x, 0.004 + (this.bumping ? 0 : Math.sin(Math.PI * t) * 0.006), z);
    this.robot.rotation.y = this.from.yaw + (this.to.yaw - this.from.yaw) * (this.bumping ? 0 : k);
    if (t < 1) return;

    // Step finished: take the pose the core computed.
    const step = this.steps[this.stepIndex];
    if (!this.bumping) {
      this.col = step.pose.col;
      this.row = step.pose.row;
      this.dir = step.pose.dir;
      this.yaw = this.to.yaw;
    }
    this.nextStep();
  }

  private showDone(): void {
    const last = this.challenge === CHALLENGES.length - 1;
    if (last) markLevelDone(2);
    this.ui['prog-edit']?.setProperties({ display: 'none' });
    this.ui['prog-done']?.setProperties({ display: 'flex' });
    this.ui['done-title']?.setProperties({ text: last ? 'Level complete!' : 'Great!' });
    this.ui['done-text']?.setProperties({
      text: last ? 'You programmed the robot.' : 'The robot reached the star.',
    });
    this.ui['next-label']?.setProperties({ text: last ? 'NEXT LEVEL' : 'NEXT' });
    playSfx(last ? 'end' : 'correct');
  }
}

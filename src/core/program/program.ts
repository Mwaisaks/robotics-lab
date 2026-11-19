/**
 * Level 2 "Program the robot": pure rules (spec: docs/activities/program.md).
 * No three.js / IWSDK / DOM imports. Renderers animate `RunResult.steps` and
 * emit LearningEvents from `ProgramState.lastRun` (until src/core/events.ts lands).
 */
import { CHALLENGES, GRID_SIZE, MAX_BLOCKS, type Challenge, type Dir, type Pose } from './challenges';

export type Move = 'fwd' | 'back' | 'left' | 'right';
export type RepeatCount = 2 | 3 | 4;
export type Block = { cmd: Move } | { cmd: 'repeat'; n: RepeatCount };

export type ProgramMistake =
  | 'HIT_WALL'
  | 'HIT_OBSTACLE'
  | 'MISSED_GOAL'
  | 'WRONG_TURN'
  | 'TOO_MANY_BLOCKS'
  | 'EMPTY_PROGRAM';

export type RunOutcome = 'solved' | 'HIT_WALL' | 'HIT_OBSTACLE' | 'MISSED_GOAL';

/** One executed step. `block` is the index of the move block (for highlighting). */
export interface Step {
  cmd: Move;
  block: number;
  /** Pose after the step (unchanged on a bump). */
  pose: Pose;
  bump?: 'wall' | 'obstacle';
}

export interface RunResult {
  outcome: RunOutcome;
  steps: Step[];
  final: Pose;
}

export interface RunReport {
  result: RunResult | null; // null for an empty program
  mistake?: { code: ProgramMistake; detail?: string };
}

export interface ProgramState {
  challenge: number;
  blocks: Block[];
  /** RUN presses with at least one block. */
  tries: number;
  mistakes: number;
  /** Best stars earned so far on this challenge (0 = not solved). */
  bestStars: 0 | 1 | 2 | 3;
  lastRun: RunReport | null;
}

export type ProgramInput =
  | { type: 'add'; block: Block }
  | { type: 'remove' } // remove the last block
  | { type: 'clear' }
  | { type: 'run' };

const DC = [0, 1, 0, -1];
const DR = [-1, 0, 1, 0];

/** Expand blocks into moves. REPEAT n does the next block n times. */
export function compile(blocks: readonly Block[]): { cmd: Move; block: number }[] {
  const out: { cmd: Move; block: number }[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.cmd !== 'repeat') {
      out.push({ cmd: b.cmd, block: i });
      continue;
    }
    const next = blocks[i + 1];
    if (!next || next.cmd === 'repeat') continue; // nothing to repeat: no effect
    for (let k = 0; k < b.n; k++) out.push({ cmd: next.cmd, block: i + 1 });
    i++;
  }
  return out;
}

function isBlocked(ch: Challenge, col: number, row: number): boolean {
  return ch.obstacles.some(([c, r]) => c === col && r === row);
}

function atGoal(ch: Challenge, p: Pose): boolean {
  return p.col === ch.goal.col && p.row === ch.goal.row;
}

/** Run a program from the challenge start. Stops at the star or on the first bump. */
export function simulate(ch: Challenge, blocks: readonly Block[]): RunResult {
  let pose: Pose = { ...ch.start };
  const steps: Step[] = [];
  for (const { cmd, block } of compile(blocks)) {
    if (cmd === 'left' || cmd === 'right') {
      pose = { ...pose, dir: ((pose.dir + (cmd === 'right' ? 1 : 3)) % 4) as Dir };
      steps.push({ cmd, block, pose });
      continue;
    }
    const sign = cmd === 'fwd' ? 1 : -1;
    const col = pose.col + sign * DC[pose.dir];
    const row = pose.row + sign * DR[pose.dir];
    if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) {
      steps.push({ cmd, block, pose, bump: 'wall' });
      return { outcome: 'HIT_WALL', steps, final: pose };
    }
    if (isBlocked(ch, col, row)) {
      steps.push({ cmd, block, pose, bump: 'obstacle' });
      return { outcome: 'HIT_OBSTACLE', steps, final: pose };
    }
    pose = { ...pose, col, row };
    steps.push({ cmd, block, pose });
    if (atGoal(ch, pose)) return { outcome: 'solved', steps, final: pose };
  }
  return { outcome: 'MISSED_GOAL', steps, final: pose };
}

function swapTurns(blocks: readonly Block[]): Block[] {
  return blocks.map((b) =>
    b.cmd === 'left' ? { cmd: 'right' } : b.cmd === 'right' ? { cmd: 'left' } : b,
  );
}

/** Stars for one solved run: 1 solved, 2 within par, 3 within par on the first try. */
export function starsFor(blockCount: number, par: number, firstTry: boolean): 1 | 2 | 3 {
  if (blockCount > par) return 1;
  return firstTry ? 3 : 2;
}

function run(state: ProgramState): ProgramState {
  if (state.blocks.length === 0) {
    return {
      ...state,
      mistakes: state.mistakes + 1,
      lastRun: { result: null, mistake: { code: 'EMPTY_PROGRAM' } },
    };
  }
  const ch = CHALLENGES[state.challenge];
  const tries = state.tries + 1;
  const result = simulate(ch, state.blocks);
  let mistake: RunReport['mistake'];
  let bestStars = state.bestStars;

  if (result.outcome === 'solved') {
    const s = starsFor(state.blocks.length, ch.par, tries === 1);
    if (s > bestStars) bestStars = s;
    if (state.blocks.length > ch.par) mistake = { code: 'TOO_MANY_BLOCKS' };
  } else if (simulate(ch, swapTurns(state.blocks)).outcome === 'solved') {
    mistake = { code: 'WRONG_TURN', detail: result.outcome };
  } else {
    mistake = { code: result.outcome };
  }

  return {
    ...state,
    tries,
    bestStars,
    mistakes: state.mistakes + (mistake ? 1 : 0),
    lastRun: { result, mistake },
  };
}

/** Matches the Activity<State> contract in docs/BRIEF.md (bus wiring comes with events.ts). */
export const programActivity = {
  id: 'program' as const,

  init(challenge: number): ProgramState {
    if (!Number.isInteger(challenge) || challenge < 0 || challenge >= CHALLENGES.length) {
      throw new RangeError(`No program challenge ${challenge}`);
    }
    return { challenge, blocks: [], tries: 0, mistakes: 0, bestStars: 0, lastRun: null };
  },

  apply(state: ProgramState, input: ProgramInput): ProgramState {
    switch (input.type) {
      case 'add': {
        if (state.blocks.length >= MAX_BLOCKS) return state;
        const last = state.blocks[state.blocks.length - 1];
        if (input.block.cmd === 'repeat' && last?.cmd === 'repeat') return state;
        return { ...state, blocks: [...state.blocks, input.block] };
      }
      case 'remove':
        return state.blocks.length ? { ...state, blocks: state.blocks.slice(0, -1) } : state;
      case 'clear':
        return state.blocks.length ? { ...state, blocks: [] } : state;
      case 'run':
        return run(state);
    }
  },

  isComplete(state: ProgramState): boolean {
    return state.bestStars > 0;
  },

  stars(state: ProgramState): 0 | 1 | 2 | 3 {
    return state.bestStars;
  },
};

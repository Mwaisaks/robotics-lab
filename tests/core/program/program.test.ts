import { describe, expect, it } from 'vitest';
import {
  CHALLENGES,
  GRID_SIZE,
  MAX_BLOCKS,
  type Challenge,
  type Dir,
} from '../../../src/core/program/challenges';
import {
  compile,
  programActivity,
  simulate,
  starsFor,
  type Block,
  type Move,
  type ProgramState,
  type RepeatCount,
} from '../../../src/core/program/program';

const F: Block = { cmd: 'fwd' };
const B: Block = { cmd: 'back' };
const L: Block = { cmd: 'left' };
const R: Block = { cmd: 'right' };
const REP = (n: RepeatCount): Block => ({ cmd: 'repeat', n });

/** Open 5x5 board with the robot in the middle and the goal out of the way. */
function open(dir: Dir, col = 2, row = 2, obstacles: [number, number][] = []): Challenge {
  return { start: { col, row, dir }, goal: { col: 4, row: 4 }, obstacles, par: 8 };
}

/** Build a state with the given blocks via apply (exercises the add rules). */
function withBlocks(challenge: number, blocks: Block[]): ProgramState {
  let s = programActivity.init(challenge);
  for (const block of blocks) s = programActivity.apply(s, { type: 'add', block });
  return s;
}

function runOnce(challenge: number, blocks: Block[]): ProgramState {
  return programActivity.apply(withBlocks(challenge, blocks), { type: 'run' });
}

describe('constants', () => {
  it('grid is 5x5, max 8 blocks, 5 challenges', () => {
    expect(GRID_SIZE).toBe(5);
    expect(MAX_BLOCKS).toBe(8);
    expect(CHALLENGES).toHaveLength(5);
  });

  it('challenges match the spec table', () => {
    const spec = [
      { start: [2, 4, 0], goal: [2, 1], obstacles: [], par: 3 },
      { start: [0, 4, 0], goal: [2, 2], obstacles: [], par: 5 },
      { start: [1, 4, 0], goal: [2, 1], obstacles: [[1, 2]], par: 6 },
      { start: [0, 2, 1], goal: [4, 2], obstacles: [], par: 2 },
      { start: [0, 4, 1], goal: [2, 0], obstacles: [[0, 2], [1, 2], [2, 2], [3, 2]], par: 7 },
    ];
    spec.forEach((s, i) => {
      const ch = CHALLENGES[i];
      expect([ch.start.col, ch.start.row, ch.start.dir]).toEqual(s.start);
      expect([ch.goal.col, ch.goal.row]).toEqual(s.goal);
      expect(ch.obstacles.map((o) => [...o])).toEqual(s.obstacles);
      expect(ch.par).toBe(s.par);
    });
  });
});

describe('blocks: FORWARD / BACK', () => {
  // dir: [dCol, dRow] for FORWARD. N = row - 1, E = col + 1, S = row + 1, W = col - 1.
  const delta: Record<Dir, [number, number]> = { 0: [0, -1], 1: [1, 0], 2: [0, 1], 3: [-1, 0] };

  for (const dir of [0, 1, 2, 3] as Dir[]) {
    it(`FORWARD facing ${'NESW'[dir]} moves one square, keeps facing`, () => {
      const r = simulate(open(dir), [F]);
      expect(r.steps).toHaveLength(1);
      expect(r.final).toEqual({ col: 2 + delta[dir][0], row: 2 + delta[dir][1], dir });
      expect(r.steps[0]).toEqual({ cmd: 'fwd', block: 0, pose: r.final });
    });

    it(`BACK facing ${'NESW'[dir]} moves one square backwards, no turn`, () => {
      const r = simulate(open(dir), [B]);
      expect(r.final).toEqual({ col: 2 - delta[dir][0], row: 2 - delta[dir][1], dir });
      expect(r.steps[0].bump).toBeUndefined();
    });
  }

  it('FORWARD then BACK returns to the start', () => {
    expect(simulate(open(1), [F, B]).final).toEqual({ col: 2, row: 2, dir: 1 });
  });
});

describe('blocks: LEFT / RIGHT (robot view)', () => {
  it('from N: RIGHT -> E, LEFT -> W', () => {
    expect(simulate(open(0), [R]).final.dir).toBe(1);
    expect(simulate(open(0), [L]).final.dir).toBe(3);
  });

  it('from S (facing the player): RIGHT -> W, LEFT -> E', () => {
    expect(simulate(open(2), [R]).final.dir).toBe(3);
    expect(simulate(open(2), [L]).final.dir).toBe(1);
  });

  it('from E: RIGHT -> S, LEFT -> N; from W: RIGHT -> N, LEFT -> S', () => {
    expect(simulate(open(1), [R]).final.dir).toBe(2);
    expect(simulate(open(1), [L]).final.dir).toBe(0);
    expect(simulate(open(3), [R]).final.dir).toBe(0);
    expect(simulate(open(3), [L]).final.dir).toBe(2);
  });

  it('turns do not move the robot', () => {
    const r = simulate(open(0), [R, L, L, R]);
    for (const s of r.steps) expect([s.pose.col, s.pose.row]).toEqual([2, 2]);
  });

  for (const dir of [0, 1, 2, 3] as Dir[]) {
    it(`4 RIGHTs and 4 LEFTs from ${'NESW'[dir]} return to start`, () => {
      const rights = simulate(open(dir), [R, R, R, R]);
      expect(rights.steps.map((s) => s.pose.dir)).toEqual([1, 2, 3, 0].map((k) => (dir + k) % 4));
      expect(rights.final).toEqual({ col: 2, row: 2, dir });
      const lefts = simulate(open(dir), [L, L, L, L]);
      expect(lefts.steps.map((s) => s.pose.dir)).toEqual([3, 2, 1, 0].map((k) => (dir + k) % 4));
      expect(lefts.final).toEqual({ col: 2, row: 2, dir });
    });
  }

  it('turn then FORWARD moves in the new direction', () => {
    expect(simulate(open(0), [R, F]).final).toEqual({ col: 3, row: 2, dir: 1 });
    expect(simulate(open(0), [L, F]).final).toEqual({ col: 1, row: 2, dir: 3 });
  });
});

describe('compile()', () => {
  it('empty program compiles to nothing', () => {
    expect(compile([])).toEqual([]);
  });

  it('plain blocks map 1:1 with their index', () => {
    expect(compile([F, L, B, R])).toEqual([
      { cmd: 'fwd', block: 0 },
      { cmd: 'left', block: 1 },
      { cmd: 'back', block: 2 },
      { cmd: 'right', block: 3 },
    ]);
  });

  for (const n of [2, 3, 4] as RepeatCount[]) {
    it(`REPEAT ${n} repeats the next block ${n} times with the move block's index`, () => {
      const out = compile([L, REP(n), F, R]);
      expect(out).toEqual([
        { cmd: 'left', block: 0 },
        ...Array.from({ length: n }, () => ({ cmd: 'fwd' as Move, block: 2 })),
        { cmd: 'right', block: 3 },
      ]);
    });
  }

  it('REPEAT repeats turns too', () => {
    expect(compile([REP(2), R]).map((s) => s.cmd)).toEqual(['right', 'right']);
  });

  it('REPEAT only repeats the one block after it', () => {
    expect(compile([REP(2), F, L]).map((s) => s.cmd)).toEqual(['fwd', 'fwd', 'left']);
  });

  it('trailing REPEAT has no effect', () => {
    expect(compile([F, REP(3)])).toEqual([{ cmd: 'fwd', block: 0 }]);
    expect(compile([REP(4)])).toEqual([]);
  });

  it('REPEAT followed by REPEAT: the first has no effect', () => {
    expect(compile([REP(2), REP(3), F])).toEqual([
      { cmd: 'fwd', block: 2 },
      { cmd: 'fwd', block: 2 },
      { cmd: 'fwd', block: 2 },
    ]);
  });

  it('does not mutate the input', () => {
    const blocks: Block[] = [REP(2), F];
    const copy = JSON.parse(JSON.stringify(blocks));
    compile(blocks);
    expect(blocks).toEqual(copy);
  });
});

describe('simulate(): bumps and outcomes', () => {
  it('HIT_WALL at each edge going FORWARD', () => {
    // N edge
    expect(simulate(open(0, 2, 0), [F]).outcome).toBe('HIT_WALL');
    // E edge
    expect(simulate(open(1, 4, 2), [F]).outcome).toBe('HIT_WALL');
    // S edge
    expect(simulate(open(2, 2, 4), [F]).outcome).toBe('HIT_WALL');
    // W edge
    expect(simulate(open(3, 0, 2), [F]).outcome).toBe('HIT_WALL');
  });

  it('HIT_WALL going BACK off each edge', () => {
    expect(simulate(open(2, 2, 0), [B]).outcome).toBe('HIT_WALL'); // facing S, back = N
    expect(simulate(open(3, 4, 2), [B]).outcome).toBe('HIT_WALL'); // facing W, back = E
    expect(simulate(open(0, 2, 4), [B]).outcome).toBe('HIT_WALL'); // facing N, back = S
    expect(simulate(open(1, 0, 2), [B]).outcome).toBe('HIT_WALL'); // facing E, back = W
  });

  it('wall bump: pose unchanged, step has bump=wall, final = pre-bump pose', () => {
    const r = simulate(open(0, 2, 1), [F, F]);
    expect(r.outcome).toBe('HIT_WALL');
    expect(r.steps).toHaveLength(2);
    expect(r.steps[1]).toEqual({ cmd: 'fwd', block: 1, pose: { col: 2, row: 0, dir: 0 }, bump: 'wall' });
    expect(r.final).toEqual({ col: 2, row: 0, dir: 0 });
  });

  it('HIT_OBSTACLE: pose unchanged, step has bump=obstacle', () => {
    const r = simulate(open(1, 1, 2, [[2, 2]]), [F]);
    expect(r.outcome).toBe('HIT_OBSTACLE');
    expect(r.steps).toEqual([{ cmd: 'fwd', block: 0, pose: { col: 1, row: 2, dir: 1 }, bump: 'obstacle' }]);
    expect(r.final).toEqual({ col: 1, row: 2, dir: 1 });
  });

  it('HIT_OBSTACLE going BACK', () => {
    expect(simulate(open(1, 3, 2, [[2, 2]]), [B]).outcome).toBe('HIT_OBSTACLE');
  });

  it('run stops at the first bump (later blocks not run)', () => {
    const r = simulate(open(0, 2, 0), [F, R, F, F]);
    expect(r.steps).toHaveLength(1);
    expect(r.final).toEqual({ col: 2, row: 0, dir: 0 });
  });

  it('bump inside a REPEAT stops the remaining repeats', () => {
    const r = simulate(open(0, 2, 1), [REP(4), F, R]);
    expect(r.outcome).toBe('HIT_WALL');
    expect(r.steps).toHaveLength(2);
    expect(r.steps.every((s) => s.block === 1)).toBe(true);
  });

  it('MISSED_GOAL when the program ends off the star', () => {
    const r = simulate(CHALLENGES[0], [F]);
    expect(r.outcome).toBe('MISSED_GOAL');
    expect(r.final).toEqual({ col: 2, row: 3, dir: 0 });
  });

  it('turns-only program ends with MISSED_GOAL', () => {
    expect(simulate(CHALLENGES[0], [L, R]).outcome).toBe('MISSED_GOAL');
  });

  it('empty program simulates to MISSED_GOAL at start', () => {
    const r = simulate(CHALLENGES[0], []);
    expect(r.outcome).toBe('MISSED_GOAL');
    expect(r.steps).toEqual([]);
    expect(r.final).toEqual(CHALLENGES[0].start);
  });

  it('stops as soon as the star is reached (extra blocks skipped)', () => {
    const r = simulate(CHALLENGES[0], [F, F, F, F, F, L]);
    expect(r.outcome).toBe('solved');
    expect(r.steps).toHaveLength(3);
    expect(r.final).toEqual({ col: 2, row: 1, dir: 0 });
  });

  it('star reached in the middle of a REPEAT stops the run', () => {
    const r = simulate(CHALLENGES[0], [REP(4), F]);
    expect(r.outcome).toBe('solved');
    expect(r.steps).toHaveLength(3);
  });

  it('a later wall after the star never happens', () => {
    // 4 FORWARDs would hit nothing here, but 5 would reach row 0 then wall; the star at row 1 wins.
    expect(simulate(CHALLENGES[0], [F, F, F, F, F, F]).outcome).toBe('solved');
  });

  it('does not mutate the challenge start pose', () => {
    const ch = open(0);
    simulate(ch, [F, R, F]);
    expect(ch.start).toEqual({ col: 2, row: 2, dir: 0 });
  });
});

describe('all 5 challenges: spec example solutions', () => {
  const solutions: Block[][] = [
    [F, F, F],
    [F, F, R, F, F],
    [F, R, F, L, F, F],
    [REP(4), F],
    [REP(4), F, L, REP(4), F, L, REP(2), F],
  ];

  solutions.forEach((blocks, i) => {
    it(`challenge ${i + 1} is solved with blocks === par`, () => {
      expect(blocks.length).toBe(CHALLENGES[i].par);
      const r = simulate(CHALLENGES[i], blocks);
      expect(r.outcome).toBe('solved');
      expect([r.final.col, r.final.row]).toEqual([CHALLENGES[i].goal.col, CHALLENGES[i].goal.row]);
    });

    it(`challenge ${i + 1} example earns 3 stars on the first try`, () => {
      const s = runOnce(i, blocks);
      expect(s.lastRun?.result?.outcome).toBe('solved');
      expect(s.lastRun?.mistake).toBeUndefined();
      expect(programActivity.stars(s)).toBe(3);
      expect(programActivity.isComplete(s)).toBe(true);
      expect(s.tries).toBe(1);
      expect(s.mistakes).toBe(0);
    });
  });

  it('challenge 4 unrolled (4x FORWARD) solves but is over par', () => {
    const blocks = [F, F, F, F];
    expect(simulate(CHALLENGES[3], blocks).outcome).toBe('solved');
    expect(blocks.length).toBeGreaterThan(CHALLENGES[3].par);
    const s = runOnce(3, blocks);
    expect(s.bestStars).toBe(1);
    expect(s.lastRun?.mistake).toEqual({ code: 'TOO_MANY_BLOCKS' });
  });

  it('challenge 5 has no solution without REPEAT within MAX_BLOCKS', () => {
    const moves: Block[] = [F, B, L, R];
    let solved = 0;
    let checked = 0;
    const prog: Block[] = [];
    const walk = (depth: number) => {
      if (depth > 0) {
        checked++;
        if (simulate(CHALLENGES[4], prog).outcome === 'solved') solved++;
      }
      if (depth === MAX_BLOCKS) return;
      for (const m of moves) {
        prog.push(m);
        walk(depth + 1);
        prog.pop();
      }
    };
    walk(0);
    expect(checked).toBe((4 ** 9 - 4) / 3); // sum of 4^k for k = 1..8
    expect(solved).toBe(0);
  });

  it('challenge 5 unrolled takes 12 blocks (over MAX_BLOCKS)', () => {
    const blocks = [F, F, F, F, L, F, F, F, F, L, F, F];
    expect(simulate(CHALLENGES[4], blocks).outcome).toBe('solved');
    expect(blocks.length).toBeGreaterThan(MAX_BLOCKS);
  });

  it('challenge 3 straight up hits the obstacle', () => {
    expect(simulate(CHALLENGES[2], [F, F, F]).outcome).toBe('HIT_OBSTACLE');
  });

  it('challenge 5 straight up from the start hits the wall of obstacles', () => {
    expect(simulate(CHALLENGES[4], [L, F, F]).outcome).toBe('HIT_OBSTACLE');
  });
});

describe('starsFor()', () => {
  it('1 over par, 2 within par later, 3 within par first try', () => {
    expect(starsFor(4, 3, true)).toBe(1);
    expect(starsFor(4, 3, false)).toBe(1);
    expect(starsFor(3, 3, false)).toBe(2);
    expect(starsFor(2, 3, false)).toBe(2);
    expect(starsFor(3, 3, true)).toBe(3);
    expect(starsFor(1, 3, true)).toBe(3);
  });
});

describe('programActivity.init', () => {
  it('starts empty for every challenge', () => {
    for (let i = 0; i < CHALLENGES.length; i++) {
      expect(programActivity.init(i)).toEqual({
        challenge: i,
        blocks: [],
        tries: 0,
        mistakes: 0,
        bestStars: 0,
        lastRun: null,
      });
    }
  });

  it('throws RangeError for -1, 5, 1.5, NaN', () => {
    for (const bad of [-1, 5, 1.5, NaN]) expect(() => programActivity.init(bad)).toThrow(RangeError);
  });

  it('id is program', () => {
    expect(programActivity.id).toBe('program');
  });
});

describe('programActivity.apply: editing', () => {
  it('add appends blocks in order', () => {
    expect(withBlocks(0, [F, L, REP(2), F]).blocks).toEqual([F, L, REP(2), F]);
  });

  it('add respects MAX_BLOCKS (9th block ignored, same state returned)', () => {
    const full = withBlocks(0, Array(MAX_BLOCKS).fill(F));
    expect(full.blocks).toHaveLength(MAX_BLOCKS);
    const after = programActivity.apply(full, { type: 'add', block: L });
    expect(after).toBe(full);
    expect(after.blocks).toHaveLength(MAX_BLOCKS);
  });

  it('REPEAT can be the 8th block (counts as 1)', () => {
    const s = withBlocks(0, [...Array(7).fill(F), REP(2)]);
    expect(s.blocks).toHaveLength(8);
  });

  it('rejects REPEAT right after REPEAT', () => {
    const s = withBlocks(0, [REP(2)]);
    const after = programActivity.apply(s, { type: 'add', block: REP(3) });
    expect(after).toBe(s);
    expect(after.blocks).toEqual([REP(2)]);
  });

  it('allows REPEAT after a move block that follows a REPEAT', () => {
    expect(withBlocks(0, [REP(2), F, REP(3), L]).blocks).toHaveLength(4);
  });

  it('remove drops the last block; on empty returns the same state', () => {
    const s = withBlocks(0, [F, L]);
    expect(programActivity.apply(s, { type: 'remove' }).blocks).toEqual([F]);
    const empty = programActivity.init(0);
    expect(programActivity.apply(empty, { type: 'remove' })).toBe(empty);
  });

  it('remove then REPEAT: rule checks the new last block', () => {
    let s = withBlocks(0, [REP(2), F]);
    s = programActivity.apply(s, { type: 'remove' });
    s = programActivity.apply(s, { type: 'add', block: REP(4) });
    expect(s.blocks).toEqual([REP(2)]);
  });

  it('clear empties the program and keeps tries/mistakes/stars', () => {
    let s = runOnce(0, [F]);
    s = programActivity.apply(s, { type: 'clear' });
    expect(s.blocks).toEqual([]);
    expect(s.tries).toBe(1);
    expect(s.mistakes).toBe(1);
    const empty = programActivity.init(0);
    expect(programActivity.apply(empty, { type: 'clear' })).toBe(empty);
  });

  it('editing does not count as a try or mistake', () => {
    let s = withBlocks(0, [F, F, L]);
    s = programActivity.apply(s, { type: 'remove' });
    s = programActivity.apply(s, { type: 'clear' });
    expect(s.tries).toBe(0);
    expect(s.mistakes).toBe(0);
    expect(s.lastRun).toBeNull();
  });

  it('apply does not mutate the input state', () => {
    const s = withBlocks(1, [F, F, L, F, F]);
    const snapshot = JSON.parse(JSON.stringify(s));
    programActivity.apply(s, { type: 'add', block: R });
    programActivity.apply(s, { type: 'remove' });
    programActivity.apply(s, { type: 'clear' });
    programActivity.apply(s, { type: 'run' });
    expect(s).toEqual(snapshot);
  });
});

describe('programActivity.apply: run, tries, mistakes', () => {
  it('EMPTY_PROGRAM: not a try, counts as a mistake, result null', () => {
    const s = programActivity.apply(programActivity.init(0), { type: 'run' });
    expect(s.tries).toBe(0);
    expect(s.mistakes).toBe(1);
    expect(s.lastRun).toEqual({ result: null, mistake: { code: 'EMPTY_PROGRAM' } });
    expect(programActivity.isComplete(s)).toBe(false);
  });

  it('repeated empty runs: each is a mistake, none a try', () => {
    let s = programActivity.init(0);
    for (let i = 0; i < 3; i++) s = programActivity.apply(s, { type: 'run' });
    expect(s.tries).toBe(0);
    expect(s.mistakes).toBe(3);
  });

  it('empty run then solve still earns 3 stars (empty run is not a try)', () => {
    let s = programActivity.apply(programActivity.init(0), { type: 'run' });
    for (const b of [F, F, F]) s = programActivity.apply(s, { type: 'add', block: b });
    s = programActivity.apply(s, { type: 'run' });
    expect(s.tries).toBe(1);
    expect(s.bestStars).toBe(3);
  });

  it('every RUN with blocks is a try (repeated runs of the same program)', () => {
    let s = withBlocks(0, [F]);
    for (let i = 0; i < 4; i++) s = programActivity.apply(s, { type: 'run' });
    expect(s.tries).toBe(4);
    expect(s.mistakes).toBe(4);
  });

  it('MISSED_GOAL reported as its own code', () => {
    const s = runOnce(0, [F]);
    expect(s.lastRun?.mistake).toEqual({ code: 'MISSED_GOAL' });
    expect(s.lastRun?.result?.outcome).toBe('MISSED_GOAL');
    expect(s.bestStars).toBe(0);
    expect(programActivity.isComplete(s)).toBe(false);
  });

  it('HIT_WALL with no turn fix reports HIT_WALL', () => {
    // Challenge 1: LEFT then 3 FORWARD hits the W edge; swapped (RIGHT) hits the E edge.
    const s = runOnce(0, [L, F, F, F]);
    expect(s.lastRun?.mistake).toEqual({ code: 'HIT_WALL' });
  });

  it('HIT_WALL going BACK reports HIT_WALL', () => {
    expect(runOnce(0, [B]).lastRun?.mistake).toEqual({ code: 'HIT_WALL' });
  });

  it('HIT_OBSTACLE with no turn fix reports HIT_OBSTACLE', () => {
    const s = runOnce(2, [F, F, F]);
    expect(s.lastRun?.mistake).toEqual({ code: 'HIT_OBSTACLE' });
    expect(s.mistakes).toBe(1);
  });

  it('WRONG_TURN wins over HIT_WALL when swapping LEFT/RIGHT would solve', () => {
    const s = runOnce(1, [F, F, L, F, F]);
    expect(s.lastRun?.result?.outcome).toBe('HIT_WALL');
    expect(s.lastRun?.mistake).toEqual({ code: 'WRONG_TURN', detail: 'HIT_WALL' });
    expect(s.mistakes).toBe(1);
    expect(s.bestStars).toBe(0);
  });

  it('WRONG_TURN on challenge 5 (example with turns swapped hits the S edge)', () => {
    // REPEAT 4 FORWARD -> (4,4) facing E, RIGHT -> S, FORWARD -> off the near edge.
    const s = runOnce(4, [REP(4), F, R, REP(4), F, R, REP(2), F]);
    expect(s.lastRun?.result?.outcome).toBe('HIT_WALL');
    expect(s.lastRun?.mistake).toEqual({ code: 'WRONG_TURN', detail: 'HIT_WALL' });
  });

  it('WRONG_TURN detail can be MISSED_GOAL (challenge 3 with turns swapped)', () => {
    // F (1,3), LEFT -> W, F (0,3), RIGHT -> N, F (0,2), F (0,1): ends off the star.
    const s = runOnce(2, [F, L, F, R, F, F]);
    expect(s.lastRun?.result?.outcome).toBe('MISSED_GOAL');
    expect(s.lastRun?.mistake).toEqual({ code: 'WRONG_TURN', detail: 'MISSED_GOAL' });
  });

  it('a program with no turns never reports WRONG_TURN', () => {
    expect(runOnce(0, [F, F]).lastRun?.mistake).toEqual({ code: 'MISSED_GOAL' });
  });

  it('failed swap check does not count as an extra try', () => {
    expect(runOnce(1, [F, F, L, F, F]).tries).toBe(1);
  });
});

describe('programActivity: stars and completion', () => {
  it('3 stars: solved within par on the first try', () => {
    const s = runOnce(0, [F, F, F]);
    expect(programActivity.stars(s)).toBe(3);
  });

  it('2 stars: solved within par after a failed try', () => {
    let s = runOnce(0, [F]);
    for (const b of [F, F]) s = programActivity.apply(s, { type: 'add', block: b });
    s = programActivity.apply(s, { type: 'run' });
    expect(s.tries).toBe(2);
    expect(s.lastRun?.mistake).toBeUndefined();
    expect(programActivity.stars(s)).toBe(2);
    expect(s.mistakes).toBe(1);
  });

  it('1 star: solved over par, with TOO_MANY_BLOCKS mistake', () => {
    const s = runOnce(0, [F, F, F, F]); // star reached after 3, 4th block skipped but counts
    expect(s.lastRun?.result?.outcome).toBe('solved');
    expect(s.lastRun?.mistake).toEqual({ code: 'TOO_MANY_BLOCKS' });
    expect(s.mistakes).toBe(1);
    expect(programActivity.stars(s)).toBe(1);
    expect(programActivity.isComplete(s)).toBe(true);
  });

  it('trailing REPEAT counts toward block count for par', () => {
    const s = runOnce(0, [F, F, F, REP(2)]);
    expect(s.lastRun?.result?.outcome).toBe('solved');
    expect(s.bestStars).toBe(1);
  });

  it('bestStars never goes down on a worse later run', () => {
    let s = runOnce(3, [REP(4), F]);
    expect(s.bestStars).toBe(3);
    s = programActivity.apply(s, { type: 'clear' });
    for (const b of [F, F, F, F]) s = programActivity.apply(s, { type: 'add', block: b });
    s = programActivity.apply(s, { type: 'run' });
    expect(s.lastRun?.mistake).toEqual({ code: 'TOO_MANY_BLOCKS' });
    expect(s.bestStars).toBe(3);
    s = programActivity.apply(s, { type: 'clear' });
    s = programActivity.apply(s, { type: 'add', block: B });
    s = programActivity.apply(s, { type: 'run' });
    expect(s.lastRun?.mistake).toEqual({ code: 'HIT_WALL' });
    expect(s.bestStars).toBe(3);
    expect(programActivity.isComplete(s)).toBe(true);
  });

  it('bestStars goes up from 1 to 2 on a better later run', () => {
    let s = runOnce(3, [F, F, F, F]);
    expect(s.bestStars).toBe(1);
    s = programActivity.apply(s, { type: 'clear' });
    for (const b of [REP(4), F]) s = programActivity.apply(s, { type: 'add', block: b });
    s = programActivity.apply(s, { type: 'run' });
    expect(s.bestStars).toBe(2); // not first try any more
  });

  it('not complete before any solve', () => {
    expect(programActivity.isComplete(programActivity.init(0))).toBe(false);
    expect(programActivity.stars(programActivity.init(0))).toBe(0);
  });

  it('max-size program (8 blocks) runs', () => {
    const s = runOnce(4, [REP(4), F, L, REP(4), F, L, REP(2), F]);
    expect(s.blocks).toHaveLength(MAX_BLOCKS - 1);
    const full = runOnce(0, [L, R, L, R, L, F, F, F]);
    expect(full.blocks).toHaveLength(MAX_BLOCKS);
    // LEFT x3 + RIGHT x2 = net LEFT -> faces W -> 3 FORWARD hits W edge at col 0 after 2 moves.
    expect(full.lastRun?.result?.outcome).toBe('HIT_WALL');
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { createEventBus, type LearningEvent } from '../../../src/core/events.js';
import { ActivityTracker } from '../../../src/core/tracker.js';
import { programActivity, type Block, type ProgramState } from '../../../src/core/program/program.js';
import { reportRun } from '../../../src/core/program/report.js';

const F: Block = { cmd: 'fwd' };
const L: Block = { cmd: 'left' };
const R: Block = { cmd: 'right' };

let clock = 0;
let seen: LearningEvent[];
let tracker: ActivityTracker;

beforeEach(() => {
  clock = 1_000_000;
  seen = [];
  const bus = createEventBus();
  bus.on((e) => seen.push(e));
  tracker = new ActivityTracker(bus, () => clock);
});

function program(challenge: number, blocks: Block[]): ProgramState {
  let s = programActivity.init(challenge);
  for (const block of blocks) s = programActivity.apply(s, { type: 'add', block });
  return s;
}

function runAndReport(s: ProgramState): ProgramState {
  const next = programActivity.apply(s, { type: 'run' });
  reportRun(tracker, next);
  return next;
}

const types = () => seen.map((e) => e.type);

describe('reportRun()', () => {
  it('emits nothing before any RUN', () => {
    tracker.start('program', 0, 'web');
    seen = [];
    reportRun(tracker, programActivity.init(0));
    expect(seen).toEqual([]);
  });

  it('first-try par solve: run action, then completed with 3 stars and 0 mistakes', () => {
    tracker.start('program', 0, 'web');
    seen = [];
    clock += 12_000;
    runAndReport(program(0, [F, F, F]));
    expect(seen).toEqual([
      { type: 'action', activity: 'program', name: 'run', t: clock },
      { type: 'activity_completed', activity: 'program', challenge: 0, stars: 3, seconds: 12, mistakes: 0, t: clock },
    ]);
  });

  it('a failed run emits its mistake and does not complete', () => {
    tracker.start('program', 0, 'web');
    seen = [];
    runAndReport(program(0, [F]));
    expect(types()).toEqual(['action', 'mistake']);
    expect(seen[1]).toMatchObject({ code: 'MISSED_GOAL' });
    expect(seen[1]).not.toHaveProperty('detail');
    expect(tracker.current).toBe('program');
  });

  it('WRONG_TURN carries what actually happened in detail', () => {
    tracker.start('program', 1, 'xr');
    seen = [];
    runAndReport(program(1, [F, F, L, F, F]));
    expect(seen[1]).toMatchObject({ type: 'mistake', code: 'WRONG_TURN', detail: 'HIT_WALL' });
  });

  it('EMPTY_PROGRAM is reported', () => {
    tracker.start('program', 0, 'web');
    seen = [];
    runAndReport(programActivity.init(0));
    expect(seen[1]).toMatchObject({ type: 'mistake', code: 'EMPTY_PROGRAM' });
  });

  it('over-par solve: TOO_MANY_BLOCKS, then completed with 1 star counting it', () => {
    tracker.start('program', 3, 'web');
    seen = [];
    runAndReport(program(3, [F, F, F, F]));
    expect(types()).toEqual(['action', 'mistake', 'activity_completed']);
    expect(seen[1]).toMatchObject({ code: 'TOO_MANY_BLOCKS' });
    expect(seen[2]).toMatchObject({ stars: 1, mistakes: 1 });
  });

  it('solve after a failed try: 2 stars, mistakes counted across runs', () => {
    tracker.start('program', 1, 'web');
    seen = [];
    let s = runAndReport(program(1, [F, F, L, F, F]));
    s = programActivity.apply(s, { type: 'clear' });
    for (const block of [F, F, R, F, F]) s = programActivity.apply(s, { type: 'add', block });
    runAndReport(s);
    expect(seen[seen.length - 1]).toMatchObject({ type: 'activity_completed', challenge: 1, stars: 2, mistakes: 1 });
    expect(tracker.current).toBeNull();
  });

  it('is ignored when Level 2 is not the activity in progress', () => {
    tracker.start('sort', 0, 'web');
    seen = [];
    runAndReport(program(0, [F, F, F]));
    expect(seen).toEqual([]);
  });
});

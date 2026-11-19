import { beforeEach, describe, expect, it } from 'vitest';
import { createEventBus, type LearningEvent } from '../../src/core/events.js';
import { ActivityTracker } from '../../src/core/tracker.js';

let clock = 0;
let seen: LearningEvent[] = [];
let tracker: ActivityTracker;

beforeEach(() => {
  clock = 1_000_000;
  seen = [];
  const bus = createEventBus();
  bus.on((e) => seen.push(e));
  tracker = new ActivityTracker(bus, () => clock);
});

describe('ActivityTracker', () => {
  it('emits start, action, mistake and completion with time and mistake count', () => {
    tracker.start('circuit', 0, 'web');
    clock += 4_000;
    tracker.action('circuit', 'add_wire');
    tracker.mistake('circuit', 'LED_REVERSED');
    clock += 2_000;
    tracker.mistake('circuit', 'NO_RESISTOR', 'second try');
    clock += 6_400;
    tracker.complete('circuit', 2);

    expect(seen.map((e) => e.type)).toEqual([
      'activity_started', 'action', 'mistake', 'mistake', 'activity_completed',
    ]);
    expect(seen[0]).toEqual({ type: 'activity_started', activity: 'circuit', challenge: 0, mode: 'web', t: 1_000_000 });
    expect(seen[2]).toEqual({ type: 'mistake', activity: 'circuit', code: 'LED_REVERSED', t: 1_004_000 });
    expect(seen[3]).toMatchObject({ code: 'NO_RESISTOR', detail: 'second try' });
    expect(seen[4]).toEqual({
      type: 'activity_completed', activity: 'circuit', challenge: 0, stars: 2, seconds: 12, mistakes: 2, t: 1_012_400,
    });
    expect(tracker.current).toBeNull();
  });

  it('ignores events for an activity that is not in progress', () => {
    tracker.action('sort', 'grab_part');
    tracker.mistake('sort', 'OUT_OF_REACH');
    tracker.complete('sort', 3);
    tracker.start('program', 1, 'xr');
    tracker.mistake('sort', 'WRONG_BIN');
    tracker.complete('build', 3);
    expect(seen.map((e) => e.type)).toEqual(['activity_started']);
    expect(tracker.mistakes).toBe(0);
  });

  it('does not emit after completion or abandon', () => {
    tracker.start('sort', 0, 'xr');
    tracker.complete('sort', 1);
    tracker.complete('sort', 1);
    tracker.start('build', 0, 'xr');
    tracker.abandon();
    tracker.mistake('build', 'WRONG_SLOT');
    expect(seen.map((e) => e.type)).toEqual(['activity_started', 'activity_completed', 'activity_started']);
  });

  it('resets the mistake count and timer on a new start', () => {
    tracker.start('program', 0, 'xr');
    tracker.mistake('program', 'HIT_WALL');
    clock += 30_000;
    tracker.start('program', 1, 'xr');
    clock += 5_000;
    tracker.complete('program', 3);
    expect(seen[seen.length - 1]).toMatchObject({ challenge: 1, seconds: 5, mistakes: 0 });
  });

  it('never reports negative seconds if the clock goes backwards', () => {
    tracker.start('sort', 0, 'xr');
    clock -= 5_000;
    tracker.complete('sort', 1);
    expect(seen[seen.length - 1]).toMatchObject({ seconds: 0 });
  });
});

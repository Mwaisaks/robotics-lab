import { describe, expect, it, vi } from 'vitest';
import { createEventBus, MISTAKE_CODES, type LearningEvent } from '../../src/core/events.js';

const started: LearningEvent = { type: 'activity_started', activity: 'sort', challenge: 0, mode: 'xr', t: 1 };

describe('event bus', () => {
  it('delivers events to every listener in order', () => {
    const bus = createEventBus();
    const seen: string[] = [];
    bus.on((e) => seen.push(`a:${e.type}`));
    bus.on((e) => seen.push(`b:${e.type}`));
    bus.emit(started);
    expect(seen).toEqual(['a:activity_started', 'b:activity_started']);
  });

  it('stops delivering after unsubscribe', () => {
    const bus = createEventBus();
    const listener = vi.fn();
    const off = bus.on(listener);
    bus.emit(started);
    off();
    bus.emit(started);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps going when a listener throws', () => {
    const errors: unknown[] = [];
    const bus = createEventBus((err) => errors.push(err));
    const after = vi.fn();
    bus.on(() => {
      throw new Error('broken tutor');
    });
    bus.on(after);
    bus.emit(started);
    expect(after).toHaveBeenCalledOnce();
    expect(errors).toHaveLength(1);
  });

  it('allows unsubscribing from inside a listener', () => {
    const bus = createEventBus();
    const second = vi.fn();
    const off = bus.on(() => off());
    bus.on(second);
    bus.emit(started);
    bus.emit(started);
    expect(second).toHaveBeenCalledTimes(2);
  });
});

describe('mistake codes', () => {
  it('lists the agreed codes per activity', () => {
    expect(MISTAKE_CODES.sort).toEqual(['WRONG_BIN', 'OUT_OF_REACH', 'DROPPED_OFF_TABLE']);
    expect(MISTAKE_CODES.program).toEqual([
      'HIT_WALL', 'HIT_OBSTACLE', 'MISSED_GOAL', 'WRONG_TURN', 'TOO_MANY_BLOCKS', 'EMPTY_PROGRAM',
    ]);
    expect(MISTAKE_CODES.circuit).toEqual([
      'OPEN_LOOP', 'LED_REVERSED', 'NO_RESISTOR', 'SHORT_CIRCUIT', 'LED_NOT_IN_LOOP', 'SWITCH_NOT_IN_LOOP', 'SWITCH_OFF',
    ]);
    expect(MISTAKE_CODES.build).toEqual(['WRONG_SLOT']);
  });

  // docs/activities/mistake-codes.md (Joshua) is the source of truth: same codes, same order.
  const docs = import.meta.glob<string>('../../docs/activities/mistake-codes.md', {
    query: '?raw',
    import: 'default',
    eager: true,
  });
  const doc = Object.values(docs)[0];

  it.skipIf(doc === undefined)('match docs/activities/mistake-codes.md exactly', () => {
    const fromDoc: Record<string, string[]> = {};
    let activity: string | null = null;
    for (const line of doc!.split('\n')) {
      const header = /^## .*\(`(\w+)`/.exec(line);
      if (header) activity = header[1];
      else if (line.startsWith('## ')) activity = null;
      const row = /^\| `([A-Z_]+)` \|/.exec(line);
      if (row && activity) (fromDoc[activity] ??= []).push(row[1]);
    }
    expect(Object.keys(fromDoc).length).toBeGreaterThan(0);
    for (const [act, codes] of Object.entries(fromDoc)) {
      expect(MISTAKE_CODES[act as keyof typeof MISTAKE_CODES], act).toEqual(codes);
    }
  });
});

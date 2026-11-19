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
  it('lists the BRIEF codes for the three baseline levels', () => {
    expect(MISTAKE_CODES.sort).toEqual(['OUT_OF_REACH', 'WRONG_BIN']);
    expect(MISTAKE_CODES.program).toContain('HIT_WALL');
    expect(MISTAKE_CODES.program).toContain('MISSED_GOAL');
    expect(MISTAKE_CODES.circuit).toEqual(
      expect.arrayContaining(['OPEN_LOOP', 'LED_REVERSED', 'NO_RESISTOR', 'SHORT_CIRCUIT']),
    );
    expect(MISTAKE_CODES.build).toEqual(['WRONG_SLOT']);
  });
});

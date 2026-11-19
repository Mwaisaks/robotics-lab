import { createComponent, Types } from '@iwsdk/core';

/** A sortable part on the lab table. `slot` matches the Bin with the same slot. */
export const Part = createComponent('Part', {
  slot: { type: Types.Int8, default: 0 },
  home: { type: Types.Vec3, default: [0, 1, -0.5] },
});

/** A flat colored drop zone on the lab table. */
export const Bin = createComponent('Bin', {
  slot: { type: Types.Int8, default: 0 },
});

/** Round state, on one entity created by GameSystem. phase: 0 start, 1 playing, 2 result. */
export const GameState = createComponent('GameState', {
  phase: { type: Types.Int8, default: 0 },
  score: { type: Types.Int16, default: 0 },
  sorted: { type: Types.Int16, default: 0 },
  timeLeft: { type: Types.Float32, default: 60 },
  /** 0 fixed seated spot (fallback), 1 placed on a detected table. */
  placement: { type: Types.Int8, default: 0 },
});

/** A tappable spot on the Level 3 bench: terminal 0..7, or 8 = the LED body (flip). */
export const CircuitTap = createComponent('CircuitTap', {
  id: { type: Types.Int8, default: 0 },
});

/** A loose robot part in Level 3 Part 2. kind: 0 wheel, 1 motor, 2 controller board. */
export const BuildPart = createComponent('BuildPart', {
  kind: { type: Types.Int8, default: 0 },
  index: { type: Types.Int8, default: 0 },
});

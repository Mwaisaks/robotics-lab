/**
 * Learning events: the contract between the levels, Robo (tutor), progress and
 * the teacher dashboard (docs/BRIEF.md, "Contracts everyone codes against").
 * Pure TypeScript: no three.js, IWSDK, DOM or network imports.
 */

export type ActivityId = 'sort' | 'program' | 'circuit' | 'build' | 'micro' | 'arm';
export type Mode = 'xr' | 'web';
export type Stars = 0 | 1 | 2 | 3;

export type LearningEvent =
  | { type: 'activity_started'; activity: ActivityId; challenge: number; mode: Mode; t: number }
  | { type: 'action'; activity: ActivityId; name: string; t: number }
  | { type: 'mistake'; activity: ActivityId; code: string; detail?: string; t: number }
  | { type: 'hint_shown'; activity: ActivityId; code: string; source: 'builtin' | 'ai'; t: number }
  | {
      type: 'activity_completed';
      activity: ActivityId;
      challenge: number;
      stars: Stars;
      seconds: number;
      mistakes: number;
      t: number;
    };

/**
 * Mistake codes. Source of truth: docs/activities/mistake-codes.md (Joshua);
 * tests/core/events.test.ts checks this file against it. Code always uses
 * MISTAKE.X, so renaming a code is a one-line change to its value here.
 */
export const MISTAKE = {
  // Level 1, Sort the parts
  WRONG_BIN: 'WRONG_BIN',
  OUT_OF_REACH: 'OUT_OF_REACH',
  DROPPED_OFF_TABLE: 'DROPPED_OFF_TABLE',
  // Level 2, Program the robot
  HIT_WALL: 'HIT_WALL',
  HIT_OBSTACLE: 'HIT_OBSTACLE',
  MISSED_GOAL: 'MISSED_GOAL',
  WRONG_TURN: 'WRONG_TURN',
  TOO_MANY_BLOCKS: 'TOO_MANY_BLOCKS',
  EMPTY_PROGRAM: 'EMPTY_PROGRAM',
  // Level 3, Light it up
  OPEN_LOOP: 'OPEN_LOOP',
  LED_REVERSED: 'LED_REVERSED',
  NO_RESISTOR: 'NO_RESISTOR',
  SHORT_CIRCUIT: 'SHORT_CIRCUIT',
  LED_NOT_IN_LOOP: 'LED_NOT_IN_LOOP',
  SWITCH_NOT_IN_LOOP: 'SWITCH_NOT_IN_LOOP',
  SWITCH_OFF: 'SWITCH_OFF',
  // Level 3 Part 2, Build the robot
  WRONG_SLOT: 'WRONG_SLOT',
  // Level 4, Microcontroller lab (docs/activities/microcontroller.md)
  LED_WRONG_PIN: 'LED_WRONG_PIN',
  NO_GND: 'NO_GND',
  SENSOR_MISWIRED: 'SENSOR_MISWIRED',
  PROGRAM_INCOMPLETE: 'PROGRAM_INCOMPLETE',
  LOGIC_REVERSED: 'LOGIC_REVERSED',
  // P2, Control the arm
  TARGET_UNREACHABLE: 'TARGET_UNREACHABLE',
  JOINT_LIMIT: 'JOINT_LIMIT',
} as const;

/** Which codes each activity may emit. */
export const MISTAKE_CODES = {
  sort: [MISTAKE.WRONG_BIN, MISTAKE.OUT_OF_REACH, MISTAKE.DROPPED_OFF_TABLE],
  program: [
    MISTAKE.HIT_WALL,
    MISTAKE.HIT_OBSTACLE,
    MISTAKE.MISSED_GOAL,
    MISTAKE.WRONG_TURN,
    MISTAKE.TOO_MANY_BLOCKS,
    MISTAKE.EMPTY_PROGRAM,
  ],
  circuit: [
    MISTAKE.OPEN_LOOP,
    MISTAKE.LED_REVERSED,
    MISTAKE.NO_RESISTOR,
    MISTAKE.SHORT_CIRCUIT,
    MISTAKE.LED_NOT_IN_LOOP,
    MISTAKE.SWITCH_NOT_IN_LOOP,
    MISTAKE.SWITCH_OFF,
  ],
  build: [MISTAKE.WRONG_SLOT],
  micro: [
    MISTAKE.LED_WRONG_PIN,
    MISTAKE.LED_REVERSED,
    MISTAKE.NO_GND,
    MISTAKE.SENSOR_MISWIRED,
    MISTAKE.SHORT_CIRCUIT,
    MISTAKE.PROGRAM_INCOMPLETE,
    MISTAKE.LOGIC_REVERSED,
  ],
  arm: [MISTAKE.TARGET_UNREACHABLE, MISTAKE.JOINT_LIMIT],
} as const satisfies Record<ActivityId, readonly string[]>;

export type MistakeCode<A extends ActivityId = ActivityId> = (typeof MISTAKE_CODES)[A][number];

export type Listener = (event: LearningEvent) => void;

export interface EventBus {
  emit(event: LearningEvent): void;
  /** Subscribe to every event. Returns an unsubscribe function. */
  on(listener: Listener): () => void;
}

/** A tiny synchronous bus. A throwing listener is logged and never stops the others or the game. */
export function createEventBus(onListenerError: (err: unknown) => void = (err) => console.error('[events]', err)): EventBus {
  const listeners = new Set<Listener>();
  return {
    emit(event) {
      for (const listener of [...listeners]) {
        try {
          listener(event);
        } catch (err) {
          onListenerError(err);
        }
      }
    },
    on(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The app-wide bus. Robo, progress and sync subscribe with `events.on(...)`. */
export const events: EventBus = createEventBus();

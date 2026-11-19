/**
 * Learning events: the contract between the levels, Robo (tutor), progress and
 * the teacher dashboard (docs/BRIEF.md, "Contracts everyone codes against").
 * Pure TypeScript: no three.js, IWSDK, DOM or network imports.
 */

export type ActivityId = 'sort' | 'program' | 'circuit' | 'build' | 'arm';
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
 * Mistake codes per activity (docs/BRIEF.md, "Learning design"). The activity
 * specs in docs/activities/ own the final list; keep this in sync with them.
 */
export const MISTAKE_CODES = {
  sort: ['OUT_OF_REACH', 'WRONG_BIN'],
  program: ['HIT_WALL', 'HIT_OBSTACLE', 'MISSED_GOAL', 'TOO_MANY_BLOCKS'],
  circuit: ['OPEN_LOOP', 'LED_REVERSED', 'NO_RESISTOR', 'SHORT_CIRCUIT', 'NO_SWITCH'],
  build: ['WRONG_SLOT'],
  arm: ['TARGET_UNREACHABLE', 'JOINT_LIMIT'],
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

/**
 * Level 2 → LearningEvents. The renderer calls this after every RUN with the new
 * state; the tracker (src/core/tracker.ts) adds time, counts mistakes and emits.
 */
import type { MistakeCode } from '../events.js';
import type { ActivityTracker } from '../tracker.js';
import { programActivity, type ProgramState } from './program.js';

/**
 * Codes Phenny approved that are not yet in MISTAKE_CODES.program (src/core/events.ts).
 * The tracker doesn't validate codes at runtime, so they reach Robo and the dashboard as-is.
 * TODO: delete this cast once events.ts lists WRONG_TURN.
 */
function asProgramCode(code: string): MistakeCode<'program'> {
  return code as MistakeCode<'program'>;
}

/** Emits: action "run", then the run's mistake (if any), then completion when solved. */
export function reportRun(tracker: ActivityTracker, state: ProgramState): void {
  const run = state.lastRun;
  if (!run) return;
  tracker.action('program', 'run');
  if (run.mistake) tracker.mistake('program', asProgramCode(run.mistake.code), run.mistake.detail);
  if (run.result?.outcome === 'solved') tracker.complete('program', programActivity.stars(state));
}

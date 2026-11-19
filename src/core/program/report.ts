/**
 * Level 2 → LearningEvents. The renderer calls this after every RUN with the new
 * state; the tracker (src/core/tracker.ts) adds time, counts mistakes and emits.
 */
import type { ActivityTracker } from '../tracker.js';
import { programActivity, type ProgramState } from './program.js';

/** Emits: action "run", then the run's mistake (if any), then completion when solved. */
export function reportRun(tracker: ActivityTracker, state: ProgramState): void {
  const run = state.lastRun;
  if (!run) return;
  tracker.action('program', 'run');
  if (run.mistake) tracker.mistake('program', run.mistake.code, run.mistake.detail);
  if (run.result?.outcome === 'solved') tracker.complete('program', programActivity.stars(state));
}

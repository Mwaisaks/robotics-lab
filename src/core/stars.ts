import type { Stars } from './events.js';

/**
 * Default star rules from docs/BRIEF.md ("Learning design"). The activity owner
 * (Joshua) sets the final thresholds in docs/activities/; change them here too.
 */

/** Sort the parts: points in 60 s. 1 star for playing, 2 at 50, 3 at 90 (baseline values). */
export function sortStars(score: number): Stars {
  return score >= 90 ? 3 : score >= 50 ? 2 : 1;
}

/**
 * Program the robot: solved = 1, solved with <= par blocks = 2, solved on the
 * first RUN as well = 3. With no par set yet, every solution counts as within par.
 */
export function programStars(blocks: number, runs: number, par?: number): Stars {
  const withinPar = par === undefined || blocks <= par;
  if (!withinPar) return 1;
  return runs <= 1 ? 3 : 2;
}

/** Light it up / Build the robot: done = 1, <= 2 mistakes = 2, no mistakes = 3. */
export function mistakeStars(mistakes: number): Stars {
  return mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
}

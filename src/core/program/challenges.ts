/**
 * Level 2 challenges (spec: docs/activities/program.md).
 * Coordinates are (col, row): col 0 = left edge, row 0 = far edge, row 4 = near edge.
 * Directions: 0 = N (away from the player), 1 = E, 2 = S, 3 = W.
 */
export type Dir = 0 | 1 | 2 | 3;

export interface Pose {
  col: number;
  row: number;
  dir: Dir;
}

export interface Challenge {
  start: Pose;
  goal: { col: number; row: number };
  obstacles: ReadonlyArray<readonly [number, number]>;
  /** Blocks needed for 2 and 3 stars. */
  par: number;
}

export const GRID_SIZE = 5;
export const MAX_BLOCKS = 8;

export const CHALLENGES: readonly Challenge[] = [
  // 1. Straight line
  { start: { col: 2, row: 4, dir: 0 }, goal: { col: 2, row: 1 }, obstacles: [], par: 3 },
  // 2. One turn
  { start: { col: 0, row: 4, dir: 0 }, goal: { col: 2, row: 2 }, obstacles: [], par: 5 },
  // 3. Around one obstacle
  { start: { col: 1, row: 4, dir: 0 }, goal: { col: 2, row: 1 }, obstacles: [[1, 2]], par: 6 },
  // 4. Long straight path (REPEAT to reach par)
  { start: { col: 0, row: 2, dir: 1 }, goal: { col: 4, row: 2 }, obstacles: [], par: 2 },
  // 5. Around a wall (only solvable with REPEAT)
  {
    start: { col: 0, row: 4, dir: 1 },
    goal: { col: 3, row: 0 },
    obstacles: [
      [0, 2],
      [1, 2],
      [2, 2],
      [3, 2],
    ],
    par: 7,
  },
];

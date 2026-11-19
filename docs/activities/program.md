# Level 2: Program the robot

Owner: Joshua. Core rules: `src/core/program/`. Tests: `tests/core/program/`.
Status: Hackfest upgrade of the baseline level (4×4 grid, `x2`, 3 challenges).

## Learning outcome
**I can write a sequence of commands and use a loop to shorten it.**
Concepts: sequencing, direction from the robot's point of view, loops (REPEAT), debugging.

## Rules
- **Grid:** 5×5 squares. Some squares are blocked (obstacles). One square has the star (goal).
- **Robot:** starts on a square, facing one of 4 directions.
- **Blocks** (max 8 in a program):
  | Block | What it does |
  | --- | --- |
  | FORWARD | Move one square the way the robot faces. |
  | BACK | Move one square backwards (no turn). |
  | LEFT | Turn 90° to the **robot's** left, stay on the square. |
  | RIGHT | Turn 90° to the **robot's** right, stay on the square. |
  | REPEAT n (n = 2, 3, 4) | Do the **next** block n times. Counts as 1 block. |
- **REPEAT details** (smallest version that teaches loops; no nested groups):
  - REPEAT repeats only the one block right after it.
  - A REPEAT can't be placed right after another REPEAT (the add is ignored).
  - A REPEAT at the end of the program, with nothing after it, does nothing.
- **RUN** runs the whole program from the start position, step by step:
  - The robot reaches the star → **solved** at once (any blocks left are skipped).
  - A move would leave the grid → the robot bumps, stops: `HIT_WALL`.
  - A move would enter a blocked square → the robot bumps, stops: `HIT_OBSTACLE`.
  - The program ends and the robot isn't on the star → `MISSED_GOAL`.
  - RUN with no blocks → `EMPTY_PROGRAM` (not counted as a try).
- **Wrong-turn check:** when a run fails, the core also runs the same program with
  every LEFT and RIGHT swapped. If that version solves the challenge, the mistake is
  reported as `WRONG_TURN` (detail = what actually happened, e.g. `HIT_WALL`).
- **Tries:** every RUN with at least one block is a try.
- Kept from the baseline renderer: one block per press; presses ignored for 0.6 s after a challenge loads.

## Stars
| Stars | Rule |
| --- | --- |
| 1 | Solved |
| 2 | Solved with blocks ≤ par |
| 3 | Solved with blocks ≤ par **on the first try** |

A solved program over par also reports `TOO_MANY_BLOCKS` (a nudge, the challenge still counts as solved).

## Challenges
Coordinates are (column, row). Column 0 is the left edge; row 0 is the far edge, row 4 the near edge.
Facing: N = away from the player, E = player's right, S = toward the player, W = player's left.

| # | Idea | Start | Goal | Obstacles | Par | Example solution |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Straight line | (2,4) N | (2,1) | none | 3 | FORWARD ×3 |
| 2 | One turn | (0,4) N | (2,2) | none | 5 | FORWARD, FORWARD, RIGHT, FORWARD, FORWARD |
| 3 | Around one obstacle | (1,4) N | (2,1) | (1,2) | 6 | FORWARD, RIGHT, FORWARD, LEFT, FORWARD, FORWARD |
| 4 | Long straight path | (0,2) E | (4,2) | none | 2 | REPEAT 4, FORWARD |
| 5 | Around a wall | (0,4) E | (3,0) | (0,2) (1,2) (2,2) (3,2) | 7 | REPEAT 4, FORWARD, LEFT, REPEAT 4, FORWARD, LEFT, FORWARD |

Challenges 4 and 5 need REPEAT to reach par. Challenge 5 can't be solved at all without
REPEAT (the shortest program without it is 11 blocks; the limit is 8).

## Mistake codes
| Code | When | Robo hint (EN) | Robo hint (SW, draft: native speaker must review) |
| --- | --- | --- | --- |
| `HIT_WALL` | A move would leave the grid | The robot hit the edge. Count the squares before you move forward. | Roboti imegonga ukingo. Hesabu miraba kabla ya kusonga mbele. |
| `HIT_OBSTACLE` | A move would enter a blocked square | Something is in the way. Try turning before you move forward. | Kuna kizuizi njiani. Jaribu kugeuka kabla ya kusonga mbele. |
| `MISSED_GOAL` | Program ended, robot not on the star | Close! The program ended before the star. Add the missing steps. | Karibu! Programu imeisha kabla ya nyota. Ongeza hatua zinazokosekana. |
| `WRONG_TURN` | Failed run that would solve with LEFT/RIGHT swapped | Left and right are from the robot's view. Look at where its eyes point. | Kushoto na kulia ni kwa mtazamo wa roboti. Angalia macho yake yanaelekea wapi. |
| `TOO_MANY_BLOCKS` | Solved, but blocks > par | You did it! Can you use REPEAT to do it with fewer blocks? | Umeweza! Je, unaweza kutumia RUDIA ili utumie vipande vichache? |
| `EMPTY_PROGRAM` | RUN with no blocks | Add some blocks first, then press RUN. | Ongeza vipande kwanza, kisha bonyeza ENDESHA. |

UI words for the blocks in Kiswahili come from `src/shell/i18n.ts` (RUDIA = REPEAT, ENDESHA = RUN, per the hints above).

## Simplification note (shown on screen)
Label on screen: "Simplified robot simulation" (max 5 words, via i18n). For the presenter:
the robot moves exactly one square per step; real robots drift, so real code checks sensors.

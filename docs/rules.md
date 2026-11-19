# Robot Arm Lab: game rules (current defaults)

Status: **reviewed by Joshua (robotics): approved** (Quest 3 test, 2026-11-18).
Each value below is a single constant in the code, so Mike and Joshua can change it.

## Round
- **Goal:** sort each part into the bin of the same colour and shape (cube -> red square, cylinder -> blue circle, hex prism -> yellow hexagon).
- **Round length:** 60 seconds (`ROUND_SECONDS`, `src/game.ts`). The timer starts at the **first correct placement**; until then one part glows as a hint.
- **Correct placement:** +10 points (`POINTS`). A part that comes to rest within **13 cm** of its own bin's centre snaps in (`SNAP_RADIUS`).
- **Wrong bin:** no points; the part returns to the table (strict radius **8.5 cm**, `BIN_RADIUS`).
- **All three sorted:** a fresh, shuffled set appears after 0.7 s (`REFILL_DELAY`), so the round keeps going until the timer ends.
- **Dropped off the table:** the part returns to its spot (`src/part-respawn.ts`).
- **Stars** (`starsFor`, `src/game.ts`): 1 star for playing, 2 stars at 50 points, 3 stars at 90 points.

## Robot arm (Step 4)
- 2-segment arm with a gripper at the front-right corner of the play area: upper arm **0.25 m**, forearm **0.23 m** (`ARM`, `src/robot-arm.ts`).
- **Reach:** **0.48 m** from the shoulder (`ARM_REACH` = upper arm + forearm).
- While a part is held, the arm turns and reaches toward it. If the part is beyond reach, the arm stretches as far as it can and the **forearm turns red** (out of the robot's workspace). This is visual only; it does not block placement.
- It wiggles happily after a correct placement.

## Play area placement
- If a real table (labelled "table" or "desk" in the headset's room setup) is in front of the seated player, top 0.4-1.1 m high, near edge within 0.9 m, the play area sits on it (`src/table-placement.ts`).
- Otherwise: a fixed spot about 0.5 m in front of the player.

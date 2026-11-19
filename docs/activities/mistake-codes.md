# Mistake codes and Robo hints (all levels)

Owner: Joshua (content). One table for Phenny (`events.ts` codes) and Rebecca (built-in hint files).
Hints: max 2 short sentences, explain WHY, encouraging.
**Kiswahili is a draft: a native speaker must review it before the demo.**
Level specs: `program.md` (Level 2). `sort.md` and `circuit.md` to follow.

## Level 1: Sort the parts (`sort`)
| Code | When | EN | SW (draft) |
| --- | --- | --- | --- |
| `WRONG_BIN` | Part dropped in a bin that doesn't match its colour/shape | That bin is for a different part. Match the colour and the shape outline. | Kisanduku hicho ni cha kifaa kingine. Linganisha rangi na umbo. |
| `OUT_OF_REACH` | Part held beyond the arm's reach (arm turns red) | The arm can't reach that far. Every robot has a workspace: the area it can reach. | Mkono wa roboti hauwezi kufika mbali hivyo. Kila roboti ina eneo inaloweza kufikia. |
| `DROPPED_OFF_TABLE` | Part dropped outside the play area (it returns) | Oops, it fell off. Place parts gently inside the work area. | Lo, kimeanguka. Weka vifaa ndani ya eneo la kazi. |

## Level 2: Program the robot (`program`)
| Code | When | EN | SW (draft) |
| --- | --- | --- | --- |
| `HIT_WALL` | Robot would drive off the grid | The robot hit the edge. Count the squares before you move forward. | Roboti imegonga ukingo. Hesabu miraba kabla ya kusonga mbele. |
| `HIT_OBSTACLE` | Robot would drive into a blocked square | Something is in the way. Try turning before you move forward. | Kuna kizuizi njiani. Jaribu kugeuka kabla ya kusonga mbele. |
| `MISSED_GOAL` | Program ended, robot not on the star | Close! The program ended before the star. Add the missing steps. | Karibu! Programu imeisha kabla ya nyota. Ongeza hatua zinazokosekana. |
| `WRONG_TURN` | Failed run that would succeed with LEFT/RIGHT swapped | Left and right are from the robot's view. Look at where its eyes point. | Kushoto na kulia ni kwa mtazamo wa roboti. Angalia macho yake yanaelekea wapi. |
| `TOO_MANY_BLOCKS` | Solved, but more blocks than par | You did it! Can you use REPEAT to do it with fewer blocks? | Umeweza! Je, unaweza kutumia RUDIA ili utumie vipande vichache? |
| `EMPTY_PROGRAM` | RUN pressed with no blocks | Add some blocks first, then press RUN. | Ongeza vipande kwanza, kisha bonyeza ENDESHA. |

## Level 3: Light it up (`circuit`, simplified circuit model)
| Code | When | EN | SW (draft) |
| --- | --- | --- | --- |
| `OPEN_LOOP` | The circuit isn't a closed loop | Electricity needs a full loop. Connect back to the battery's minus side. | Umeme unahitaji mzunguko kamili. Unganisha tena upande hasi wa betri. |
| `LED_REVERSED` | LED connected the wrong way round | LEDs only work one way. The long leg (+) goes toward the battery's plus side. | LED hufanya kazi upande mmoja tu. Mguu mrefu (+) uelekee upande chanya wa betri. |
| `NO_RESISTOR` | No resistor in the loop | Add a resistor. It limits the current so the LED doesn't burn out. | Ongeza kipingamizi. Hupunguza mkondo ili LED isiungue. |
| `SHORT_CIRCUIT` | Battery + wired straight to − with nothing between | That's a short circuit. Current must pass through the parts, not around them. | Hiyo ni saketi fupi. Mkondo lazima upite kwenye vifaa, si kuvizunguka. |
| `LED_NOT_IN_LOOP` | LED isn't part of the loop (baseline: "Put the LED in the loop") | The LED isn't in the loop yet. Wire it between the resistor and the battery. | LED bado haiko kwenye mzunguko. Iunganishe kati ya kipingamizi na betri. |
| `SWITCH_NOT_IN_LOOP` | Switch missing from the loop (baseline: "Add the switch to the loop") | Add the switch to the loop and turn it on to let the current flow. | Weka swichi kwenye mzunguko na uiwashe ili mkondo upite. |
| `SWITCH_OFF` | Switch in the loop but open | Add the switch to the loop and turn it on to let the current flow. | Weka swichi kwenye mzunguko na uiwashe ili mkondo upite. |

## Codes beyond the list in AGENTS.md / the role file
New: `DROPPED_OFF_TABLE`, `WRONG_TURN`, `EMPTY_PROGRAM`, `LED_NOT_IN_LOOP`, `SWITCH_NOT_IN_LOOP`, `SWITCH_OFF`.
All approved by Phenny (19 Nov). `src/core/events.ts` on main still lacks `WRONG_TURN` (program) and `SWITCH_OFF` (circuit).

Built-in hint files generated from this table: `src/tutor/hints.en.json`, `src/tutor/hints.sw.json`
(`{ "<activity>": { "<CODE>": "hint" } }`). Edit this table first, then the JSON.

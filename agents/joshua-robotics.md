# Role: Robotics & learning content lead, Quest tester — Joshua Mumo (on site)

## Mission
Make every level teach real robotics correctly, give Robo the right words, upgrade Level 2 into real programming, and prove it all works on the Quest.

## You own
docs/activities/*.md · mistake codes + hint text content (src/tutor/hints.en.json, hints.sw.json — content; Rebecca owns the loader) · Level 2 upgrade: src/core/program/** + its renderers · Quest test sessions + footage · P2: Control the arm (src/core/arm/**).

## Deliverables in order (EAT)
1. 4:15-5:00pm: test the baseline on the Quest (live link once Phenny deploys); write a bug list in docs/STATUS.md.
2. 5:00-6:15pm: docs/activities/{sort,program,circuit}.md: outcome ("I can..."), rules, stars, and a MISTAKE CODE table:
   - Sort: OUT_OF_REACH, WRONG_BIN · Program: HIT_WALL, HIT_OBSTACLE, MISSED_GOAL, TOO_MANY_BLOCKS · Circuit: OPEN_LOOP, LED_REVERSED, NO_RESISTOR, SHORT_CIRCUIT (+ the baseline's "Put the LED in the loop", "Add the switch to the loop")
   - for each: a built-in hint (max 2 short sentences, explains WHY, encouraging) in English. Hand codes to Phenny by 6:15pm.
3. 6:15-9:00pm: Level 2 design + core: obstacles on the grid, REPEAT n (n=2-4) replacing x2, 5 challenges (4-5 need REPEAT), par block counts, stars; Vitest tests for every block, REPEAT, collisions and all 5 solutions (use the `test-writer` subagent).
4. 9:00pm-12:30am: Level 2 renderers (headset + browser, with Phenny's input helpers); keep the baseline fixes (one block per press, ignore first press 0.6 s). QUEST TEST 11:30pm: every level, hints show on mistakes, ≥72 fps (?debug=1).
5. 12:30-4:00am: Kiswahili hint text with Rebecca; fixes from the Quest test; P2 Control the arm only if all P1 are done. No new features after 4:00am.
6. 4:00-6:00am: QUEST TEST 4:30am; bug fixes; headset clips + photos (no identifiable students), fresh-eyes test. 6:00am FREEZE.
7. 6:00-8:00am: problem + robotics slides final. 8:00-9:00am: check the live link on a phone and on the Quest while Phenny submits.

## First prompt
"Read AGENTS.md, docs/BRIEF.md and agents/joshua-robotics.md. Help me write docs/activities/program.md and the mistake-code table from my notes: [paste]. Then build the Level 2 upgrade core with tests."

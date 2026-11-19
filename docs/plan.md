# PLAN: Robot Arm Lab (Meta VR Start 2026)

Read `context.md` first. Follow these steps in order. Do not start a step until the previous step's **gate** passes. After each step: run the gate checks, commit, and report to the user in 3-5 lines (what works, what doesn't, next step).

## Ground rules for Claude Code
1. **No guessing APIs.** Before coding any IWSDK feature, read the relevant guide in `context.md` and the generated starter code. Cite which doc or file you used.
2. **Never add Claude as co-author** on git commits (no `Co-Authored-By` trailer). Short, plain commit messages.
3. **Commit after every working step.** Tag a known-good version with `git tag good-N` so we can roll back.
4. **Smallest working version first.** Keep one scene, one task, one loop. If something takes more than 45 minutes, stop, tell the user, and use the fallback listed in that step.
5. Run `npm run typecheck` (if TypeScript) and `npm run build` before declaring any step done. A step that doesn't build is not done.
6. Everything is hands-first. No controller input anywhere.
7. Don't add features that aren't in this plan. Ask the user first.
8. Keep the app light: few draw calls, small textures, no large assets, to protect 60fps.

## Deadline clock (Nairobi time, EAT; deadline 11:00pm)
| Time | Step |
|---|---|
| Now to 2:30am | Step 0 (concept lock, setup), then the user sleeps |
| 8:00-9:00 | Step 1: starter running |
| 9:00-12:00 | Steps 2-3: core hands loop and scoring (playable) |
| 12:00-14:00 | Steps 4-5: robot arm hook, polish and audio |
| 14:00-16:00 | Step 6: deploy to a public link, test cold |
| 16:00-19:00 | Step 7: demo video and Devpost text (Mike, Joshua, Phenny) |
| By 21:00 | Step 8: SUBMIT. 2-hour buffer before the 11pm deadline |

If we are behind at 12:00, skip the robot hook (Step 4). If behind at 16:00, skip all polish and deploy what works.

## TIME WARNINGS (replaces the 4:00pm feature freeze, removed on Nov 18)
Before every report: run `TZ=Africa/Nairobi date`, show the time and the hours left until the **9:00pm submit target** and the **11:00pm hard deadline**. Warn loudly at:
- **6:00pm:** "Video footage must be recorded from the final build soon."
- **7:30pm:** "Stop new features. Bug fixes, merge and deploy only."
- **8:30pm:** "Submit now."

Safe submission build: tag `release-1` (commit `7542fb9`). New work (Level 2) happens on branch `levels`; `main` keeps the live link working and is merged only with Phenny's approval.

---

## Step 0: Lock the concept (15 min, user + teammates)
- Confirm "Robot Arm Lab" as in `context.md` with Mike and Joshua.
- Ask Mike and Joshua for a half-page **rules spec** by 8:00am: the task, how many parts, the rules for a correct placement, scoring, and how the arm should move (reach limits, joints). Put it in `docs/rules.md` in the repo.
- Phenny creates the repo (`robot-arm-lab`) and a README stub.
- **Gate:** concept confirmed in writing; repo exists.

## Step 1: Starter running (about 45 min)
- Check `node -v` is 20.19+ (or 22.12+ / 24+).
- Run `npm create @iwsdk@latest`. Name: `robot-arm-lab`. Target: **Mixed reality / passthrough**. Choose **Customize setup**, enable grabbing, physics, and room surfaces/anchors if offered. Pick TypeScript if the user is comfortable with it, otherwise JavaScript. Initialize git.
- `cd robot-arm-lab && npm run dev`. Open the printed URL in Chrome.
- Read `iwsdk.config.json`, `src/index.ts`, `src/robot.ts`, `src/robot-component.ts`, and `public/scenes/main.iwsdk.scene.json`. Write a 10-line summary of how the starter is structured in `docs/starter-notes.md`.
- Read the Testing experience guide. Learn how to enter an emulated immersive session and drive emulated hands.
- **Gate:** the dev server runs, the scene loads, and in the emulator you enter the immersive session and see the starter robot; verified on Quest (passthrough session starts, hands tracked). `git commit`; `git tag good-1`.
- **Status (Nov 18):** `good-1` tagged on the emulator check only (scene loads, Enter XR works). **Quest check for good-1 is PENDING** (delegated to Joshua).
- **Fallback:** if the emulator fails, check the Troubleshooting page and the starter's own README. Do not switch engines.

## Step 2: Hands loop (about 2 hours)
Goal: the player can pick up a part with their hand and release it.
- Read the Built-in interactions guide and the Custom systems guide.
- Build a table-top scene: a flat play area, 3 small colored parts (cube/cylinder), 3 matching bins (flat, colored zones). Use simple shapes from Three.js, no external models yet.
- Make parts grabbable by hand using the SDK's built-in grabbing (don't write your own hand math if the SDK provides it). Make parts fall or rest on the table with simple physics if the SDK's physics is enabled, otherwise keep them where released.
- Room surfaces/anchors are worth attempting: we have a Quest and can test on a real table. Place the play area on the detected table surface. If that is slow or fails, place it at a fixed spot in front of the player at a comfortable seated height. **Don't spend more than 30 minutes on anchoring.**
- **Gate:** in the emulator and verified on Quest, you can grab each part and put it down; frames feel smooth (60fps on Quest); no console errors. Commit; `git tag good-2`.
- **Fallback:** if grabbing is flaky, use **pinch-to-pick** (nearest part within reach follows the pinch point until release).

## Step 3: Game loop and scoring (about 1 hour)
- Rule source: `docs/rules.md` from Mike and Joshua. If missing, use: sort each part into the matching bin; +10 per correct placement; wrong bin gives no points and the part returns to the table; 60-second timer; total score shown at the end.
- States: **Start** (panel with title, one-line instruction, a "Start" button you can poke or pinch) -> **Playing** (timer, score in a panel near the play area) -> **Result** (score, "Play again").
- Use the SDK's spatial UI (`.uikitml` panels as in the starter). Keep text large and short, readable within a narrow field of view, and placed in front of the player, not at the edges.
- Make "Play again" fully reset state, positions and score, with no page reload needed.
- **Gate:** a full run from Start to Result and "Play again" works three times in a row with no errors, in the emulator and verified on Quest (panels readable, buttons pokeable by hand). Commit; `git tag good-3`. **From here on, the project is demoable.**

## Step 3b: Place the play area on a real table (max 45 minutes)
Judges test in their own rooms, so the fallback must always work.
- Read the IWSDK scene understanding docs and the starter code first (`iwsdk.config.json` already enables `sceneUnderstanding`, `planeDetection`, `meshDetection`, `anchors`). Don't guess APIs.
- On entering XR, look for a detected horizontal table-height plane within reach. If found, move the whole play area (table top, bins, parts) onto it.
- **Fallback:** if no table is found within a couple of seconds (or scene understanding is unavailable or denied), keep the current fixed seated spot. The player must never be left with nothing to play.
- **Gate:** in the emulator (sunlit_living_room has a table) the play area snaps to the table; with detection unavailable it uses the fixed spot; the Step 3 loop still works; verified on Quest on a real table and with no table nearby. Commit; `git tag good-3b`. If not done in 45 minutes, revert to `good-3` and keep the fixed spot.

## Step 4: Robot hook (about 1.5 hours; SKIP if behind schedule)
Goal: make the robotics expertise visible, which is what sets us apart in Innovation.
- Reuse the starter robot (`robot.ts`) or a simple Three.js arm (a base plus 2-3 jointed segments plus a gripper).
- Version A (preferred): when the player pinches a part, the robot arm reaches toward it and mirrors the motion, respecting reach limits from `docs/rules.md`; when the target is beyond the reach limit, the arm segment turns red and the part can't be placed. This teaches the idea of a robot workspace.
- Version B (fallback): the arm idles and plays a short "success" animation when a part lands in the correct bin.
- **Gate:** the loop from Step 3 still works with the arm present, in the emulator and verified on Quest; frame rate unaffected (60fps on Quest). Commit; `git tag good-4`. If it breaks the loop and can't be fixed in 30 minutes, revert to `good-3`.

## Step 5: Polish (about 1.5 hours)
In this order, stop when time runs out:
0. **Learner-simple design** (audience: secondary school students / young learners):
   1. No reading needed: one big word per button (START, AGAIN); each bin shows the outline/shape of its matching part as well as its color.
   2. Timer starts only after the first correct placement; a gentle pulsing glow on one part hints where to start.
   3. Forgiving placement: a part released near its correct bin snaps in; wrong bin gets a soft "try again" sound and the part returns.
   4. Feedback: "+10" pop, bin flashes green, cheerful sound; the robot arm celebrates.
   5. Result shows 1-3 stars plus the score, then AGAIN.
   Keep everything light for 60fps.
1. **Audio**: a short sound for grab, correct placement, wrong placement, and end of round. Small compressed files only.
2. **Feedback**: highlight a part when the hand is near it; flash the bin green on success.
3. **Look**: a clean consistent color palette, a soft environment/lighting setup per the Environment and lighting guide, no placeholder gray boxes if avoidable.
4. **Onboarding**: the Start panel shows a one-line "pinch to pick, drop in the matching bin" instruction.
5. **Performance**: keep draw calls and textures low; if the starter has heavy defaults, trim them. Check the frame rate in the browser's performance tools.
- **Gate:** a first-time user (a teammate who hasn't seen it) can understand and finish a round in under 60 seconds with no explanation; checked in the emulator and verified on Quest (60fps, hand tracking, passthrough). Commit; `git tag good-5`.

## Step 6: Deploy and test cold (about 1.5 hours)
- Read the Build and deploy guide. Run `npm run build` and `npm run preview` locally first.
- Deploy to a public static host as the guide describes (GitHub Pages is the documented route). The URL must work with **HTTPS** and no login.
- Test the link in a **clean browser profile / incognito**, on at least one other device, and on the Quest.
- Write `README.md`: what it is, how to play, the live link, the tech used, and how to run locally.
- **Gate:** a person who is NOT the developer opens the link and completes a round; the hosted link is verified on Quest. Commit; `git tag release-1`.

## Step 7: Demo video and Devpost text (about 3 hours, Mike, Joshua, Phenny)
Judges score Polish & Presentation from the video, so don't rush it.
- **Story source:** the video script and the Devpost text use `docs/story.md` (tagline, Inspiration) and the 60-second spoken version in `docs/context.md` "Story and pitch". Lead with the game; the education story is the "why". Follow its "Things not to claim" list.
- **Resolve every [confirm] in `docs/story.md` and `docs/context.md` before submitting.**
- **Video rules:** under 3 minutes, **real gameplay footage** only (screen recording of the emulator or headset footage; no AI-generated video). Clear audio.
- **Suggested script (about 2:00-2:30):**
  - 0:00-0:15 Hook: the problem (robotics is hard to practice without equipment) and the one-line pitch.
  - 0:15-0:30 Who made it (3 people) and what the experience is.
  - 0:30-1:45 Live gameplay: Start, grab and place, the robot arm reacting, scoring, Result.
  - 1:45-2:15 Why it matters (learners without lab access; robotics practice anywhere) and the hands-first design.
  - 2:15-2:30 Technical note: hand tracking, passthrough, Immersive Web SDK, runs from a link.
- Record gameplay several times and keep the cleanest take. Do the voice-over separately if needed.
- **Devpost write-up** (draft with Claude, edit by the team): inspiration, what it does, how we built it, challenges, what's next, track and division chosen, and the live link. Keep claims honest; only describe features that exist.
- Primary footage: record from the Quest headset (real passthrough + hands). Emulator capture only as backup.
- The video must be **PUBLIC on YouTube or Vimeo** (not unlisted, not private).
- **Gate:** video uploaded as PUBLIC on YouTube or Vimeo and the text is finished; footage verified on Quest (recorded from the headset).

## Step 8: Submit (by 9:00pm EAT)
Checklist, all must be true:
- [ ] Phenny, Mike and Joshua are all on the Devpost team, all 18+, and all have a Meta account with Developer Access; Phenny (the submitter) is a Meta VR Start member (per Official Rules)
- [ ] Track and division selected (suggest: Gaming or Productivity, division New Experience; decide with the team)
- [ ] Hosted link works in an incognito window, no login
- [ ] Demo video under 3 minutes, plays for anyone who has the link
- [ ] All required Devpost fields filled; review the submission requirements tab one last time
- [ ] Submit, then reopen the submission and confirm it shows as submitted
- [ ] Keep the 9pm-11pm window only for emergencies, not for building

## Quality gates (used throughout)
- Runs: no red errors in the browser console during a full round.
- Understandable: a stranger finishes a round without help.
- Smooth: no stutters during grabbing; keep scene complexity low.
- Honest: the demo shows only what really works.
- Reproducible: `git clone` plus `npm install` plus `npm run dev` works from the README.

## Scope cuts, in order, if time runs short
1. Robot arm reach limits (keep the idle arm)
2. Room anchoring (use a fixed spot)
3. Physics (parts stay where released)
4. Extra sound and lighting polish
Never cut: the hands loop, scoring, Start/Result/Play again, the deployed link, the demo video.

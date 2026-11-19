# Role: Team lead, integrator, browser mode & QA — Phenny Mwaisaka (on site)

## Mission
Keep main always working and deployed; make every level playable WITHOUT a headset; wire learning events so Robo and the dashboard work.

## You own
Repo/CI/Vercel wiring, README, AGENTS.md, docs/STATUS.md · src/core/events.ts (+ hooks in Levels 1-3) · src/web/** (browser renderer + mouse/touch input) · src/shell/** (menu, class-code/nickname screen, onboarding, i18n.ts en+sw, settings: language, read-aloud, large text) · PWA/offline · merges and tags (baseline, demo-1, demo-2, final).

## Deliverables in order (EAT)
1. 4:00-5:00pm: COPY the newest prototype folder; in the copy remove .git and node_modules; git init; README "Prior work" section; commit "Baseline: Robot Arm Lab prototype (prior work, 18 Nov)"; tag baseline; push to new public repo robotics-lab; add agent pack + docs/BRIEF.md (commit "Add Hackfest plan and agent rules"); Vercel deploy (with the account owner); CI typecheck+test+build (add Vitest if missing).
2. By 6:30pm: src/core/events.ts (LearningEvent types per BRIEF) + a tiny event bus; emit activity_started / action / mistake{code} / activity_completed from Levels 1-3 using Joshua's mistake codes; post "events live" in chat for Rebecca.
3. 6:30-9:00pm (G1): browser mode for Level 1: detect no-XR (or a "Play in browser" button), orbit-free fixed camera over the table, raycast click/tap = select/pinch, drag = move, same core rules. First do a 30-min spike: read IWSDK docs/types for non-XR page input; if not workable, render the existing scene with plain three.js camera + pointer events. Don't invent APIs.
4. 9:00pm-12:30am (G2): browser mode for Levels 2 and 3; class-code + nickname screen (stored locally; passed to Rebecca's sync); tag demo-1 after the Quest test.
5. 12:30-2:00am: Kiswahili toggle (all strings via i18n), offline PWA (cache app + built-in hints). README draft at 2:00am.
6. 2:00-4:00am: read-aloud (speechSynthesis, en/sw where available) + large-text option; full regression both modes; tag demo-2. 4:00am FREEZE.
7. 4:00-7:00am: README final ("Prior work", "Built at MksU Hackfest" list matching `git log baseline..main`, setup, technologies, dependencies, external resources + licences), slides, submit by 7:00am, tag final.

## Review checklist for every PR
CI green · stays in owner's folders · src/core pure + tested · events emitted · strings via i18n · mouse AND touch work on the preview link · no secrets · no brand names · no history rewriting. Use the `reviewer` subagent.

## First prompt
"Read AGENTS.md, docs/BRIEF.md and agents/phenny-integrator.md. I've copied the prototype into this folder without .git. Do deliverable 1 step by step and stop before pushing so I can confirm the repo name and remote."

# Robotics Lab – Project Brief (Machakos Hackfest, Education Track)

Nov 19, 2026 · @Mwaisaka

## Overview

**Robotics Lab lets a secondary school student practise robotics with just their hands, a table, and a VR headset or any laptop browser, guided by an AI tutor, while the teacher sees each student's progress.**

- **One-line pitch:** a hands-on robotics lab for schools that can't afford robotics kits. Learners sort parts, program a robot, wire circuits and build a robot in mixed reality, with an AI tutor that explains mistakes.
- **Who it's for:** secondary school students (about 12–18) starting robotics, and the teachers and trainers who run their sessions. It's designed with Tukuze Afrika's work in Meru County schools in mind.
- **What's new vs. the Meta prototype:** we build on our Nov 18 prototype (declared as prior work) in an 18-hour overnight build with a team of 3. The game idea stays the same. We add:
  - a **browser mode** (no headset needed)
  - an **AI tutor** (hints and explanations, English and Kiswahili)
  - **adaptive difficulty**
  - a **teacher dashboard**
  - deeper robotics levels (assembly and arm control)
- **Why now:** robotics and coding are being pushed into schools, but kits are expensive and scarce. One kit is shared by many students, and most of them watch instead of doing. Software can give every student hands-on practice before they touch the real kit.
- **Honesty rule:** we only claim what the build does. We never say students have already used it, or that it replaces a physical lab.

## Hackathon and track

**We're entering MksU Hackfest 2026, "Architecting a Resilient Future", in the Education, Governance & Civic Innovation track, as a team of 3: Phenny (lead), Joshua and Rebecca (online).** Source: the organisers' [Hackfest brief](https://docs.google.com/presentation/d/1f33EUN-3D1aEbcyzjicxxj6_VDjJ47SgXV87AMwHjV4/htmlpresent).

- **Dates:**
  - build starts Thu 19 Nov, 4:00pm EAT, overnight
  - **final submission closes Fri 20 Nov, 10:00am EAT** (we submit by 9:00am)
  - presentations and judging on Fri in the Amphitheatre *\[time TBC\]*
- **Track focus:** digital learning and **accessibility** in education. Solutions should address challenges in Kenya and Africa, with **measurable impact**.
- **Rules that matter to us:**
  - teams of 3–5 with a named leader (Phenny)
  - solutions must be original and developed during the Hackfest
  - acknowledge external resources, APIs, datasets and open-source components
  - use AI and third-party tools responsibly
  - respect IP and data privacy
- **Prior work:** the organisers told us building on our Nov 18 prototype is allowed, as long as we show clearly what we built during the Hackfest. We do that openly:
  - a tagged **`baseline`** commit
  - a **"Prior work"** section in the README
  - every Hackfest feature lands as separate commits after the baseline
  - *\[Get this permission in writing (email or chat message) and keep it.\]*
- **Submission (three parts):**
  1. **GitHub repository:** source code; a README describing the project; setup and install steps; a list of technologies, dependencies and external resources.
  2. **Presentation:** the problem, the solution and target users, key features and technologies, the implementation approach, and expected impact.
  3. **Working demo:** the prototype, with a deployment link.
- **Team info to submit:**
  - project title and track
  - all member names
  - the leader's contact details
  - the repo link
  - the slides
  - the deployment link
- **Still unknown:** the submission channel (to be announced), judging criteria and weights, and pitch length.
- **How we score on this track:**
  - **Accessibility:** a headset is optional; it runs on school laptops and phones, with Kiswahili and read-aloud.
  - **Resilience:** works offline, with built-in hints when there's no internet.
  - **Measurable impact:** a teacher dashboard with stars, time and common mistakes per class.
  - **Kenya and Africa focus:** Meru schools, and few robotics kits.

## Problem and users

**Robotics is learned by doing, but in most schools we work with, one kit serves many students. Most learners watch instead of building, and teachers can't see who actually understands.**

| User | What they need | What gets in their way today | What Robotics Lab gives them |
| --- | --- | --- | --- |
| **Student** (12–18, often new to tech) | Hands-on practice, fast feedback, confidence | Few kits, short sessions, fear of breaking parts, English-only material | Unlimited practice with hands, instant feedback, an AI tutor in English or Kiswahili |
| **Teacher / trainer** (e.g. Tukuze Afrika) | Know who is stuck and on what; run a class with little equipment | Can't watch 40 students at once; no data | A class dashboard: progress, time, common mistakes |
| **School** | Low-cost, works on existing devices, safe | Kits cost a lot; unreliable internet | Runs in a browser on lab laptops and phones; a headset is optional; works offline after first load (stretch) |

**Real constraints we design for:**

- Most schools have **no VR headset**, so **browser mode is required**, not a bonus. The headset is the "wow" mode for one station per class.
- **Internet is patchy.** The core game must work without the network. The AI tutor degrades to built-in hints when offline.
- **Shared devices.** No accounts or passwords for students. A teacher-made class code plus a nickname is enough.
- **Minors' privacy.** No real names, photos or personal data are stored. Nicknames only.
- **Short sessions.** Each activity takes 2–5 minutes, with a clear finish.

## Solution and features

**We start from the Nov 18 prototype (the baseline) and spend the 18 hours on what makes it a school-ready learning tool: browser mode, the Robo tutor, the teacher dashboard, Kiswahili and offline use.** Everything is tagged by priority:

- **P0** = the demo fails without it
- **P1** = strongly wanted
- **P2** = stretch

Build every P0 before any P1.

### Baseline (prior work, Nov 18): declared, not counted as Hackfest work

The baseline already has: a Quest WebXR app (Immersive Web SDK) with hand tracking, passthrough and real-table placement; a level menu with progress ticks; a how-to card; sounds; and a GitHub Pages deploy. Levels:

- **Level 1 Sort the parts**, with the robot arm, reach limit and stars
- **Level 2 Program the robot**: 4×4 grid, FORWARD/BACK/LEFT/RIGHT/x2, 3 challenges
- **Level 3 Light it up**: tap-to-wire LED circuit with mistake messages
- *\[confirm whether "Build the robot" (Level 3 Part 2) made it into the baseline\]*

### Hackfest work (what we build Thu 4:00pm → Fri 6:00am freeze)

| # | Feature | Why it matters for the track | Priority | Owner |
| --- | --- | --- | --- | --- |
| 1 | **Learning events + mistake codes** wired into all 3 levels (`src/core/events.ts`) | Feeds Robo, the dashboard and the impact numbers | P0 | Phenny |
| 2 | **Browser mode**: every level playable with mouse and touch on a laptop or phone, no headset | Accessibility: most schools have no headset | P0 | Phenny |
| 3 | **Robo tutor, built-in hints** (English) on every mistake, within 1 s, offline | Explains *why*; works without internet | P0 | Rebecca (text: Joshua) |
| 4 | **Robo AI hints** via `/api/hint` (LLM), 3 s timeout → built-in hint | Personal explanations | P0 | Rebecca |
| 5 | **Class code + nickname entry, progress sync, teacher dashboard** (stars, time, top mistakes per class) | Measurable impact for teachers | P0 | Rebecca (entry screen: Phenny) |
| 6 | **Deploy on Vercel** (app + API), with the baseline's GitHub Pages as a fallback | One live link for judges | P0 | Phenny |
| 7 | **Level 2 upgrade**: obstacles, `REPEAT n`, 5 challenges where 4–5 need loops, par block counts | Real programming concepts | P1 | Joshua |
| 8 | **Kiswahili** for all UI text and hints (language toggle) | Accessibility, local relevance | P1 | Phenny (plumbing), Joshua + Rebecca (text) |
| 9 | **Offline-first** (installable PWA): the app and built-in hints work with no network; progress syncs later | "Resilient future" theme | P1 | Phenny |
| 10 | **Read-aloud** for instructions and hints (browser speech) + large-text option | Accessibility for weaker readers | P1 | Phenny |
| 11 | **Adaptive difficulty**: the next challenge depends on success and time | Personalised learning | P2 | Rebecca |
| 12 | **Control the arm**: joint sliders + 2-link inverse kinematics, joint angles shown | Deeper robotics | P2 | Joshua |

**Build all P0 before any P1, and all P1 before any P2.** The activity and platform tables below describe the full vision. For tonight, this table wins.

### Learning activities

| # | Activity | What the learner does | Robotics idea | Priority |
| --- | --- | --- | --- | --- |
| 1 | **Sort the parts** | Pinch (or click) coloured parts into matching bins in 60 s. A robot arm follows the held part and turns red when it's out of reach. | Workspace and reach | P0 |
| 2 | **Program the robot** | Build a program from big blocks (FORWARD, BACK, LEFT, RIGHT, REPEAT n), press RUN, and drive a robot to the star around obstacles. 5 challenges. | Sequencing, loops, debugging | P0 |
| 3 | **Light it up** | Wire battery → switch → resistor → LED by tapping terminals, then press POWER. Mistakes get explained (open loop, LED backwards, no resistor). | Circuits, polarity, current limiting | P0 |
| 4 | **Build the robot** | Snap 2 wheels, 2 motors and a controller board onto a chassis, then press GO and it drives. | Mechanical assembly, subsystems | P1 |
| 5 | **Control the arm** | Move base, shoulder and elbow sliders to hit targets, or pinch a target and watch 2-link inverse kinematics solve it, with joint angles shown. | Joints, angles, kinematics | P1 |
| 6 | **Sensor + program** | Add an ultrasonic "distance" block: the robot stops before a wall. | Sensors, conditionals | P2 |

### Platform features

| Feature | What it does | Priority |
| --- | --- | --- |
| **Two modes, one codebase** | **Headset mode** (Quest: hands, passthrough, real-table placement) and **browser mode** (laptop or phone: mouse or touch, same activities). | P0 |
| **Home menu and navigation** | Activity cards, MENU/EXIT everywhere, NEXT after completion. | P0 |
| **Onboarding** | A 3-step how-to per mode (hands: "hold up hands → touch → pinch"; browser: "click → drag"). | P0 |
| **Progress** | Stars per activity, saved locally. Synced to the class when online. | P0 local / P1 sync |
| **AI tutor "Robo"** | When a learner makes a mistake or is idle, Robo gives a short hint and explains *why*, in English or Kiswahili. Built-in hints cover offline use. | P0 built-in hints / P1 AI |
| **Adaptive difficulty** | Picks the next challenge from the learner's success and time (easier after repeated fails, harder after fast clears). | P1 |
| **Teacher dashboard** | Class code, list of nicknames with stars and time per activity, and the top 3 mistakes in the class. | P1 |
| **Voice read-aloud** | Reads instructions aloud (browser speech synthesis) for weaker readers. | P2 |
| **Offline install (PWA)** | Works after the first load with no internet. | P2 |

**Out of scope for 48 hours** (put on the roadmap slide): full electronics simulation, CAD-level models, multiplayer, accounts with passwords, brand-name hardware models.

## Learning design

**Every activity follows the same 5-beat loop, so the platform feels like one coherent lab:**

1. Intro (1 line)
2. Try
3. Instant feedback
4. Explain-why (Robo)
5. Finish with stars

The robotics engineers own the content and correctness of each activity.

| Activity | Learning outcome ("I can…") | Mistakes we detect (mistake codes for Robo and the dashboard) | Stars |
| --- | --- | --- | --- |
| Sort the parts | …explain that a robot can only reach parts inside its workspace | `OUT_OF_REACH`, `WRONG_BIN` | Points in 60 s (thresholds set by the owner) |
| Program the robot | …write a sequence of commands and use a loop to shorten it | `HIT_WALL`, `HIT_OBSTACLE`, `MISSED_GOAL`, `TOO_MANY_BLOCKS` | Solved / solved with ≤ par blocks / solved first try |
| Light it up | …build a closed circuit and explain why an LED needs a resistor and the right polarity | `OPEN_LOOP`, `LED_REVERSED`, `NO_RESISTOR`, `SHORT_CIRCUIT` | Lit / lit with ≤ 2 mistakes / lit first try |
| Build the robot | …name a mobile robot's main subsystems and where they attach | `WRONG_SLOT` (+ which part) | Built / built with ≤ 2 mistakes / no mistakes |
| Control the arm | …relate joint angles to where the gripper ends up | `TARGET_UNREACHABLE`, `JOINT_LIMIT` | Targets hit within the time limit |

**Design rules for all activities:**

- **Max 5 words per instruction**, with an icon. Big buttons. No walls of text.
- **Fail softly:** a wrong move gets a gentle sound, the part returns, and Robo explains. Never a harsh buzzer or a game over.
- **First success within 15 seconds** of starting any activity.
- **Honest labels:** simplified models say so on screen ("Simplified circuit model", "Simplified drive").
- **No brand names in the app** (no "Arduino", "ESP32"). Use generic names: "Controller board", "Distance sensor", "Motor".
- **Curriculum fit:** map each outcome to Kenya's Competency-Based Curriculum strands for junior and senior school. *\[confirm the exact strands with the robotics engineers before the pitch\]*

## Technical architecture

**The architecture has one TypeScript web app with three layers.** Pure game logic is shared by both modes and unit-tested. Thin renderers sit on top: headset (Immersive Web SDK) and browser. A small serverless API handles the AI tutor and class sync. Keeping logic out of the renderers is what lets 5 people and their AI agents work in parallel without breaking each other.

### Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Language / build | TypeScript, Vite, npm | The team knows it; one language everywhere |
| Headset mode | Meta **Immersive Web SDK (IWSDK)** on Three.js: hand tracking, grab, physics, passthrough, scene understanding | Proven in our Meta prototype; runs from a link |
| Browser mode | Same Three.js scene. Mouse/touch via raycasting (click = pinch, drag = move) | No headset needed; works on school laptops and phones. **Spike in hour 1:** check how far IWSDK's own page view and pointer input get us before writing custom input. |
| Game logic | `src/core`: plain TypeScript, no rendering imports | Testable, shared by both modes |
| Tests | **Vitest** (unit), Playwright smoke test (optional), IWSDK emulator, a real Quest | QA-led |
| AI tutor | Serverless function `/api/hint` calling an LLM chosen by Rebecca. The key stays server-side, never in the browser. | Explanations in English and Kiswahili |
| Data | **Supabase** free tier (Postgres + anonymous inserts) for class progress *(default; Rebecca may choose Firebase)*. Local storage for offline. | The dashboard needs shared data |
| Hosting | **Vercel**: static site + `/api` functions + a preview link per pull request, over HTTPS (required for WebXR) | One place for app and API. GitHub Pages is the static fallback. |
| CI | GitHub Actions: typecheck, unit tests, build on every PR | Catches breakage before merge |

### Folder structure (new repo `robotics-lab`)

```text
robotics-lab/
  AGENTS.md            # rules for every AI coding agent (see below)
  docs/
    BRIEF.md           # this brief, exported
    activities/        # one spec per activity, owned by robotics engineers
    STATUS.md          # who is doing what right now, updated each milestone
  src/
    core/              # PURE LOGIC, no three.js/IWSDK imports, 100% unit-tested
      events.ts        # event bus + event types (contract below)
      progress.ts      # stars, local save, sync queue
      sort/  program/  circuit/  build/  arm/   # one folder per activity's rules
    xr/                # headset renderer + hand interactions (IWSDK)
    web/               # browser renderer + mouse/touch interactions
    shared3d/          # meshes, materials, colours, sounds used by both modes
    shell/             # home menu, navigation, onboarding, settings, language
    tutor/             # Robo: built-in hints + calls to /api/hint
  api/
    hint.ts            # LLM proxy (serverless)
    progress.ts        # class sync (serverless) if not direct to Supabase
  dashboard/           # teacher dashboard page (plain web, same repo)
  tests/               # vitest specs mirror src/core
```

### Contracts everyone codes against (agree in hours 0–2, then don't break)

```ts
// src/core/events.ts
export type ActivityId = 'sort' | 'program' | 'circuit' | 'build' | 'arm';
export type LearningEvent =
  | { type: 'activity_started'; activity: ActivityId; challenge: number; mode: 'xr' | 'web'; t: number }
  | { type: 'action'; activity: ActivityId; name: string; t: number }
  | { type: 'mistake'; activity: ActivityId; code: string; detail?: string; t: number }
  | { type: 'hint_shown'; activity: ActivityId; code: string; source: 'builtin' | 'ai'; t: number }
  | { type: 'activity_completed'; activity: ActivityId; challenge: number; stars: 0|1|2|3; seconds: number; mistakes: number; t: number };

// Every activity implements this, in src/core/<activity>/
export interface Activity<State> {
  id: ActivityId;
  init(challenge: number): State;              // pure
  apply(state: State, input: unknown): State;  // pure, emits events via the bus
  isComplete(state: State): boolean;
  stars(state: State): 0|1|2|3;
}

// Robo / AI tutor request
export interface HintRequest { activity: ActivityId; code: string; attempt: number; lang: 'en' | 'sw'; context?: string }
export interface HintResponse { text: string; source: 'builtin' | 'ai' }   // max 2 short sentences
```

**Data flow:** interaction (hand or mouse) → renderer turns it into an input → `core` updates the state and emits events. The events then go to three places:

- **the renderer**, which shows the result
- **the tutor**, which shows a hint on a `mistake`
- **progress**, which saves locally and queues sync to the class

**Performance budget (headset):**

- ≥ 72 fps on Quest 3/3S
- ≤ 100 draw calls
- no textures over 1024 px
- total download < 10 MB

## Repo and contribution workflow

**There's one new GitHub repo, `robotics-lab`. Its first commit is the declared baseline, and everything after it is Hackfest work, merged through small pull requests into a `main` that always deploys.**

**Setup (Phenny, 4:00–4:30pm):**

1. **Copy, don't delete in place.** Make a copy of the latest prototype (the newest Level 1–3 build), then remove `.git` and `node_modules` **from the copy only**. The old repo stays untouched as our record and rollback.
2. In the copy: `git init`. Add a README section **"Prior work"**: *"This project starts from our Robot Arm Lab prototype (built 18 Nov 2026 for another competition). Everything listed under 'Built at MksU Hackfest' was built 19–20 Nov."* Then:
   - commit with message `Baseline: Robot Arm Lab prototype (prior work, 18 Nov)`
   - tag `baseline`
3. Create the public GitHub repo `robotics-lab` and push `main` and the tag. Add Joshua and Rebecca as collaborators; protect `main` (PR + CI).
4. The **person hosting on Vercel** (who owns the account) imports the repo, adds the env vars (LLM key, Supabase keys) and turns on preview links per PR. Secrets go only in Vercel and in a local `.env`, never in git. Commit an `.env.example`.
5. Add the agent pack (`AGENTS.md`, `agents/`, `.claude/agents/`, `docs/STATUS.md`) and `docs/BRIEF.md` (this doc, exported as Markdown). Commit: `Add Hackfest plan and agent rules`.

**Proving the Hackfest work** (judges can check it in 1 minute):

- `git log baseline..main` lists every Hackfest commit, with timestamps from 19–20 Nov.
- The README has a **"Built at MksU Hackfest"** list matching those commits.
- Optional: tag `hackfest-start` at the first Hackfest commit, and `final` at submission.

**Branching and pull requests:**

- Branch names: `feat/<area>-<name>`, `fix/<area>-<bug>`. One feature per branch, merged within about 2 hours.
- Pull from `main` before branching and before opening a PR.
- Every PR must pass `npm run typecheck`, `npm test` and `npm run build`. It needs "how to test" steps and screenshots.
- **Reviews:** Phenny reviews and merges (with the `reviewer` subagent). Rebecca reviews Phenny's PRs.
- **Commit messages:** short, present tense, no AI co-author trailers.

**Folder ownership (3 people):**

| Folder | Owner |
| --- | --- |
| `src/core/events.ts`, level hooks, `src/shell`, browser input (`src/web`), i18n, PWA/offline, read-aloud, CI, README | Phenny |
| Level content and rules: Level 2 upgrade (`src/core/program`, its renderers), mistake codes and hint text (`src/tutor/hints.*.json`, content only), P2 arm control, `docs/activities/*` | Joshua |
| `src/tutor` (logic + UI hooks), `api/`, `dashboard/`, Supabase schema (`docs/data.md`), P2 `src/core/adaptive.ts` | Rebecca |

**Communication:**

- Rebecca is online, so use one team chat + a voice call at each team checkpoint (9:00pm, 12:30am, 4:00am, 6:00am, 8:00am).
- Post when you start or finish a branch.
- `docs/STATUS.md` updated every 2 hours.

## Team roles

**Three people, each driving their own AI coding agent.** Phenny makes it run everywhere and keeps `main` working. Joshua makes the robotics right and tests on the Quest. Rebecca, working online, builds the intelligence and the data.

| Person | Where | Role | Owns tonight (in order) | Also |
| --- | --- | --- | --- | --- |
| **Phenny Mwaisaka** | On site | Team leader, software engineer, QA. Submits the entry. | 1. Baseline repo, Vercel, CI. 2. Learning events + mistake codes in Levels 1–3. 3. **Browser mode** for all levels (mouse/touch). 4. Class-code/nickname screen. 5. Kiswahili plumbing, offline PWA, read-aloud. 6. README, regression, tags. | Reviews and merges PRs; keeps the clock; leads the slides |
| **Joshua Mumo** | On site | Robotics engineer, content lead, Quest tester | 1. Test the baseline on the Quest (4:30pm) and list bugs. 2. **Mistake codes + hint text** for every level (English, then Kiswahili). 3. **Level 2 upgrade** (obstacles, REPEAT n, 5 challenges). 4. Quest tests at 11:30pm and 3:30am. 5. P2: Control the arm. | Robotics correctness of everything; demo footage; presents the problem and robotics |
| **Rebecca** *\[surname\]* | Online | ML engineer, AI and data lead | 1. Supabase schema + AI provider + keys (with the Vercel owner). 2. **Robo**: built-in hint lookup + hint panel hook, then `/api/hint` with timeout and fallback. 3. **Progress sync + teacher dashboard** (stars, time, top mistakes). 4. Seed a demo class. 5. P2: adaptive difficulty. | Impact metrics and the AI/data/privacy slides; reviews Phenny's PRs |

**Working with Rebecca remotely:**

- She builds against a **mock event stream** until Phenny's events land (target 6:30pm), so she's never blocked.
- She tests on the **Vercel preview links** of PRs. No local headset is needed.
- The voice call at each checkpoint covers: what merged, what's next, what's blocked.

**Pairing rule:** anyone blocked for more than 30 minutes says so in the chat right away. Phenny and Joshua sit together, so swap help directly.

## 18-hour overnight plan

**Thu 4:00pm → Fri 10:00am EAT (final submission closes), with 3 people. We submit by 9:00am.** The times are our own team checkpoints, not organiser gates; each is a voice call. If a checkpoint slips, we cut scope, not time.

| Time (EAT) | Phenny (on site) | Joshua (on site) | Rebecca (online) | Checkpoint |
| --- | --- | --- | --- | --- |
| 4:00–5:00pm | Copy the prototype, new repo, **`baseline` tag**, README "Prior work", agent pack, Vercel deploy of the baseline | Test the baseline on the Quest; bug list; start the mistake-code + hint-text table (`docs/activities/`) | Supabase schema (`docs/data.md`), AI provider + keys, `/api/hint` skeleton, dashboard wireframe | Setup: repo + baseline; everyone has the repo |
| 5:00–9:00pm | `events.ts` + mistake codes emitted from Levels 1–3 (**by 6:30pm**); **browser mode** for Level 1 | Hint text in English for every code; Level 2 upgrade design (obstacles, REPEAT n, 5 challenges); start the Level 2 core + tests | Built-in hints + hint panel on a mock event stream → real events at 6:30pm; `/api/hint` working with fallback | **9:00pm:** Robo shows built-in hints in Levels 1–3; Level 1 plays in the browser |
| 9:00pm–12:30am | Browser mode for Levels 2 and 3; class-code + nickname screen | Level 2 upgrade in both modes; **Quest test 11:30pm** (all levels, hints visible) | AI hints live in the app; progress sync → Supabase; dashboard reads real data | **12:30am:** all levels in the browser + Quest; dashboard shows a test class; **tag `demo-1`** |
| 12:30–4:00am | Kiswahili toggle + plumbing; offline PWA; read-aloud + large text. **README + slide outline drafted at 4:00am.** | Kiswahili hint text (with Rebecca); fixes from the Quest test; P2 Control the arm **only** if all P1 are done. *Nap if on track.* | Dashboard polish (top mistakes, time); seed the demo class; Kiswahili review; P2 adaptive difficulty **only** if all P1 are done | All P0 merged; **no new features after 4:00am** |
| 4:00–6:00am | Bug fixes; regression in both modes | **Quest test 4:30am**; headset clips + photos for the slides; fresh-eyes test with someone nearby | Bug fixes; dashboard screenshots | **Tag `demo-2`** after a full regression |
| **6:00am** | **Feature freeze** (all) |  |  | Bug fixes only from here |
| 6:00–8:00am | Final README (prior work, Hackfest work list, setup, tech + external resources), regression | Problem + robotics slides | Impact and AI slides | Slides complete; README final |
| 8:00–9:00am | **Submit:** title + track, member names, leader's contact, repo link, slides, deployment link. Tag `final`. | Check the live link on a phone and on the Quest | Check the dashboard on the live link | **Submitted by 9:00am**, confirmed |
| 9:00–10:00am | Buffer only (final submission closes 10:00am). **No pushes to `main` after submitting.** |  |  |  |
| Before presenting | Rehearse twice; test casting and Wi-Fi in the Amphitheatre; charge the headset; phone hotspot ready |  | Join the presentation online if she presents a part (test the call first) |  |

**Hard rules learned from the Meta deadline:**

- Submit first, polish after.
- No new feature starts after 4:00am. Freeze at 6:00am.
- Phenny calls each checkpoint out loud and updates `docs/STATUS.md`.
- If a P0 is in trouble at a checkpoint, the P1 items go first.

## Instructions for AI coding agents

**Copy the block below into `AGENTS.md` at the repo root.** If your tool reads a different file, also copy it to `CLAUDE.md`. Every teammate starts each agent session with: *"Read AGENTS.md and docs/BRIEF.md, then docs/activities/\<my activity>.md. My task: …"*

```markdown
# AGENTS.md — Robotics Lab

## What this is
Robotics Lab: a hands-on robotics learning app for secondary school students in Kenya.
Activities: Sort the parts, Program the robot, Light it up, Build the robot, Control the arm.
Two modes from ONE codebase: headset (Meta Quest via Immersive Web SDK, hands only) and browser (mouse/touch).
AI tutor "Robo" explains mistakes (English + Kiswahili). Teacher dashboard shows class progress.
Full context: docs/BRIEF.md. Activity rules: docs/activities/*.md. Current state: docs/STATUS.md.

## Hard rules
1. Stay in your owner's folders (see BRIEF "Repo and contribution workflow"). If you must touch another folder or src/core/events.ts or src/shared3d, STOP and tell the human first.
2. src/core/** is PURE TypeScript: no three.js, IWSDK, DOM or network imports. Every rule change there needs a Vitest test in tests/.
3. Never invent Immersive Web SDK (IWSDK) APIs. Read the docs and node_modules/@iwsdk/* types first and cite the file/URL you used. Docs: https://developers.meta.com/vr/documentation/iwsdk/
4. Headset mode is HANDS ONLY: no controller-only input anywhere. Browser mode: every action must work with mouse AND touch.
5. Never put API keys or secrets in client code or commits. Secrets live in Vercel env vars; client calls /api/*.
6. No brand names in the app UI (no "Arduino", "ESP32"): use generic names. Simplified simulations must be labelled as simplified on screen.
7. No personal data about students: nicknames + class codes only. No photos, no real names, no location.
8. Performance budget (headset): >= 72 fps on Quest 3/3S, <= 100 draw calls, textures <= 1024px, total download < 10 MB. Reuse materials; merge static meshes.
9. UI text: max 5 words per instruction, big buttons, readable in a narrow field of view, placed in front of the user.
10. Every user-visible string goes through src/shell/i18n.ts (en + sw).
11. Emit LearningEvents (src/core/events.ts) for start, actions, mistakes (with a code from the activity spec) and completion. The tutor, progress and dashboard depend on them.
12. Smallest working version first. Don't add features that aren't in the brief or the activity spec; ask the human.

## Workflow for every task
1. Restate the task and list the files you'll change.
2. Pull main; work on a branch feat/<area>-<name>.
3. Implement core logic + tests first, then the renderer(s).
4. Run: npm run typecheck && npm test && npm run build. All must pass.
5. Test in browser mode; if you touched xr/, say what must be checked on the Quest.
6. Commit small, plain present-tense messages. Do NOT add Co-Authored-By or any AI attribution trailer.
7. Open a PR with: what/why, how to test (steps), screenshots/GIF, modes tested.
8. Report back in 3-5 lines: what works, what doesn't, what the human must test.

## When unsure
Say so, check the docs or the code, or ask. A small thing that works beats a big thing that crashes.
```

## Testing and quality gates

**Testing runs on four levels, cheapest first: unit tests on every PR, a browser check on every PR, emulator checks per headset change, and scheduled Quest sessions at checkpoints.** Phenny owns the test plan. Every activity owner adds their cases.

| Level | What | When | Who |
| --- | --- | --- | --- |
| Unit | Vitest on `src/core`: interpreter, circuit validator, assembly slots, inverse kinematics maths, scoring and stars, adaptive picker, hint lookup | Every PR (CI) | Each owner (with their agent) |
| Browser | Play the changed activity start to finish with mouse, then touch (phone), from the PR preview link | Every PR | PR author; Phenny re-checks |
| Emulator | IWSDK emulator: enter XR, hands mode, the changed activity | Any change in `src/xr` | Author |
| Quest | The full checklist below on a real headset | 11:30pm, 4:30am (before tagging demo-2), and before submitting | Phenny + Joshua |

**Quest checklist (per activity):**

- it opens from the menu
- the first success comes within 15 s
- hands are tracked; grab and poke work first time
- a mistake shows the right Robo hint
- completion shows stars, and NEXT/MENU work
- no overlapping text
- ≥ 72 fps (`?debug=1` shows the FPS)

**Must test for every activity:**

- **Edge cases:** an empty program, max blocks, a wrong polarity plus a missing resistor together, a part dropped off the table, double-taps, the hint API offline or slow (the built-in hint must appear within 1 s).
- **Regression:** before each tag (`demo-1`, `demo-2`, `final`), every activity runs once in browser mode and once on the Quest, with no console errors.
- **Fresh-eyes test:** someone outside the team finishes 2 activities without help (4:00–6:00am).

**Definition of done for any feature:**

- merged to `main` with CI green
- works in browser mode
- if it's a headset feature, checked on the Quest
- events emitted
- strings in en + sw
- listed in `STATUS.md`

## Demo, pitch and submission

**The pitch shows a real student journey live: a judge plays in the headset while the room watches the cast, and a second judge plays the same activity on their own phone.** A pre-recorded video is the backup if anything fails.

**Pitch outline** *(fit to the official time limit; a 5-minute version is shown)*:

| Time | Beat (covers the brief's required points) | Who |
| --- | --- | --- |
| 0:00–0:45 | **Problem:** one kit, many students, most of them watching; Meru schools (photos with no identifiable students) | Joshua |
| 0:45–1:15 | **Solution and target users:** students 12–18, and their teachers | Phenny |
| 1:15–3:15 | **Live demo (key features):** a judge in the headset (Sort, with the arm reacting); the same level on a phone (browser mode); a mistake → Robo's hint in Kiswahili; the dashboard updating | Phenny drives; Joshua narrates the robotics |
| 3:15–3:55 | **Technologies and implementation:** Immersive Web SDK, browser mode, events → Robo (LLM + offline hints), Supabase, Vercel; built on our 18 Nov prototype, with what we added tonight | Rebecca (live or recorded) + Phenny |
| 3:55–4:35 | **Expected impact:** every student practises; teachers see who's stuck; works offline on existing devices; a pilot in Tukuze Afrika's Meru schools | Rebecca / Phenny |
| 4:35–5:00 | Roadmap + ask | Phenny |

**Demo setup checklist:**

- Quest charged + a cable.
- **Casting** from the Quest to the laptop is set up and tested on the venue Wi-Fi. Phone hotspot as backup.
- Live link bookmarked, plus a QR code on a slide so judges can open it on their phones.
- A **demo class code** with seeded data, so the dashboard isn't empty.
- The backup video downloaded to the laptop (no streaming needed).

**Submission package** *(confirm the exact fields on the Hackfest site)*:

- repo link (public, README with setup and live link)
- live link
- demo video (2–3 min, real footage)
- slides (PDF)
- team list with roles
- track: **Education**
- short description

**README must have:**

- what it is (2 lines)
- live link + QR
- how to play (browser + headset)
- features with honest "simplified" notes
- tech stack
- run locally (`npm install && npm run dev`)
- team and roles
- screenshots

## Risks and lessons

**We missed the Meta deadline because late scope growth pushed out the video and the submission. This plan protects the submission first.**

### What worked last time (keep doing it)

- IWSDK: hands, grab, passthrough and real-table placement all worked on the Quest, smooth.
- Small steps with a tag after each, a safe branch, and the live link kept working.
- Structured Quest test guides with PASS/FAIL lines from the robotics engineer.
- Original, licence-noted sounds; simple shapes for performance.

### What went wrong (don't repeat it)

- New levels were added after the planned freeze, so the video and form were left to the last minutes.
- Footage was recorded late, and the voice-over was still being written 13 minutes before the deadline.
- Emulator testing was hard for newcomers. Use browser mode and the real Quest instead.
- Dev-server-over-Wi-Fi testing depended on one laptop staying on. Use Vercel preview links instead.

### Risks

| Risk | Likelihood | Impact | Mitigation | Owner |
| --- | --- | --- | --- | --- |
| Scope creep in the last 12 h | High | Missed submission | No new features after 4:00am, freeze at 6:00am, submit by 9:00am, form drafted at 4:00am | Phenny (clock) |
| Browser mode costs more than expected with IWSDK | Medium | No headset-free story | Hour-1 spike; fallback: plain Three.js scene + `src/core` logic | Phenny |
| Merge conflicts between our agents | High | Lost hours | Folder ownership, small PRs, frozen contracts after H2 | Phenny |
| LLM API down, slow, costly or no key | Medium | No AI hints in the demo | Built-in hint table first; cache common AI answers; 3 s timeout → built-in hint | Rebecca |
| Venue Wi-Fi blocks casting or the live link | Medium | Demo fails | Phone hotspot, local build on the laptop, backup video | Phenny |
| Hand tracking poor under venue lighting | Medium | Clumsy demo | Demo near light; point + pinch works too; browser mode on the projector | Joshua |
| Headset battery dies | Medium | No headset demo | Charge between sessions; cable; browser mode carries the demo | Joshua |
| Kiswahili quality | Medium | Embarrassing hints | Native speakers review the built-in hints; AI prompt asks for simple Kiswahili | Rebecca + all |
| Student data concerns from judges | Low | Credibility | Nicknames only, no PII, privacy slide | Rebecca |

## Open questions for the first hour

**Settle these in a 20-minute kickoff before anyone writes code.** Tick each one and write the answer next to it.

- [ ] Get the organisers' OK on building from our prototype **in writing** (chat or email), and keep it.
- [ ] Submission channel (organisers announce it), judging criteria, pitch length, presentation time.
- [ ] Name of the person hosting on Vercel (account owner); add Phenny if needed.
- [ ] Rebecca's surname and contact for the team info; whether she presents live online or by recording.
- [ ] Which prototype build is the baseline (the latest Level 1–3 branch), and whether "Build the robot" is in it.
- [ ] AI provider and credits (Rebecca); Supabase project owner.
- [ ] Headset charged + cable; casting tested on venue Wi-Fi; phone hotspot.
- [ ] Session photos for the problem slide, with students unidentifiable.
- [ ] Kiswahili reviewer for the hint text.

## Sources

- [Machakos University Hackfest 2024 results](https://mksu.ac.ke/?p=11140) (Education category winner "Classmate")
- [MksU newsletter, Issue 118](https://mksu.ac.ke/wp-content/uploads/2026/01/Issue-118.pdf.pdf) (Hackfest 2025 Education Track winner "Campus Hub")
- [Hackfest tracks page](https://hackfest.mksu.ac.ke/tracks) (didn't load at time of writing)
- [Immersive Web SDK documentation](https://developers.meta.com/vr/documentation/iwsdk/)

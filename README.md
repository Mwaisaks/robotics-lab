# Robotics Lab

**A hands-on robotics lab for schools that can't afford enough robotics kits.** Students sort parts with a robot arm, program a robot, wire circuits, build a robot and program a microcontroller, in a mixed-reality headset or in any laptop or phone browser. Robo, an AI tutor, explains every mistake in English or Kiswahili, and the teacher sees each student's progress on a class dashboard.

MksU Hackfest 2026, Education track. Team: Phenny Mwaisaka (lead), Joshua Mumo, Rebecca Okoko.

- **Live app:** https://robotics-lab-two.vercel.app (add `?debug=1` to show FPS and log learning events)
- **Teacher dashboard:** https://robotics-lab-two.vercel.app/dashboard/ (try class code `DEMO1`)
- **Fallback (static, no AI or sync):** https://mwaisaks.github.io/robotics-lab/

## Prior work

This project starts from our Robot Arm Lab prototype, built on 18 Nov 2026 for another competition. Everything listed under 'Built at MksU Hackfest' was built on 19-20 Nov 2026.

The prototype is the commit tagged [`baseline`](https://github.com/Mwaisaks/robotics-lab/tree/baseline): a Meta Quest WebXR app (Immersive Web SDK) with hand tracking, passthrough and real-table placement, a level menu, sounds, and three levels (Sort the parts with a robot arm, Program the robot on a 4x4 grid, Light it up) plus a first "Build the robot" part.

Everything after `baseline` is Hackfest work: `git log baseline..main` lists all of it (132 commits, 19 Nov 16:51 to 20 Nov 03:11 EAT), merged through the pull requests below. Tags: `baseline`, `demo-1` (Robo live), `demo-2` (feature freeze).

## Built at MksU Hackfest

**Learning platform**
- Learning events and mistake codes for every level (`src/core/events.ts`): start, actions, mistakes, completion, with time and stars. One shared table of mistake codes, checked by a test against the activity spec. (#1, #2, #4, #24, #33)
- **Browser mode**: every level plays with mouse or touch on a laptop or phone, no headset needed. Fixed camera fitted to the screen, drag-and-drop for parts. (#3, #21)
- Start screen: PLAY IN BROWSER or ENTER VR (shown only when the device supports it), class code + nickname step, or play as guest. (#3, #29)
- Level menu grouped into Beginner, Intermediate and Advanced. (#35)
- Bright procedural 3D lab room behind the table in browser mode (no textures, a few draw calls). (#38)

**Robo, the AI tutor**
- 23 built-in hints per language (English and Kiswahili), one for every mistake code, shown instantly and offline. (#6, #24, #30, #33, #34)
- AI hints from `/api/hint` (Gemini API, server-side key): the built-in hint shows at once and the AI hint replaces it if it arrives within 6 s. Student data is never sent to the model. (#6, #7, #37)
- Hint box in the browser and an in-world hint panel in the headset. (#7, #26)

**Teacher view**
- Progress sync: mistakes and completions are queued offline and sent to Supabase with class code + nickname only. (#22, #37)
- Teacher dashboard: enter a class code to see stars and time per student and level, plus the class's top 3 mistakes with Robo's explanation. Demo class `DEMO1`. (#28, #41)

**Levels**
- Level 2 upgrade: 5x5 grid, obstacles, REPEAT n blocks, 5 challenges, par block counts and stars, pure core with tests. (#27)
- Level 4, Microcontroller lab: wire an LED and a distance sensor to a board, program IF NEAR / ELSE, test it. (#34)

**Engineering**
- CI (typecheck, unit tests, build, API and dashboard typecheck), Vercel deploy with preview links per pull request, GitHub Pages fallback. (#25, #41)
- Team workflow: agent rules, coordination protocol, PR template, CODEOWNERS, line-ending rules. (#8, #20)

## Features and honest notes

| Level | What the student does | Robotics idea | Notes |
|---|---|---|---|
| 1 Sort the parts | Pinch (or drag) coloured parts into matching bins in 60 s; a robot arm follows the held part and turns red when it is out of reach | Workspace and reach | Simplified 2-link arm |
| 2 Program the robot | Build a program from FORWARD, BACK, LEFT, RIGHT and REPEAT blocks, RUN it on a 5x5 grid with obstacles | Sequencing, direction, loops, debugging | |
| 3 Light it up | Wire battery, switch, resistor and LED, press POWER | Closed loop, polarity, current limiting | **Simplified circuit model** (rule-based, not an electrical simulation); the screen says so |
| 3B Build the robot | Snap 2 wheels, 2 motors and a controller board onto a chassis, press GO | Subsystems of a mobile robot | **Simplified demo** drive (no physics) |
| 4 Microcontroller lab | Wire an LED to D13 and a distance sensor, program IF NEAR / LED ON / ELSE / LED OFF, test with the distance buttons (or a fingertip in the headset) | Inputs, outputs, decisions | **Simplified microcontroller model**: an Uno-style board, not a real board emulator |
| Advanced | Arm control, inverse kinematics, PID | | Coming soon (shown in the menu) |

- **Headset mode** (Meta Quest, hands only, passthrough) and **browser mode** (mouse or touch) run the same code and the same rules.
- **Robo** works offline with its 23 built-in hints per language; AI hints need a connection.
- **Kiswahili** hint text is a draft that still needs a native speaker's review.
- **Privacy:** students enter a nickname and a class code only; no real names, photos or accounts.

### Known limits

- Headset: in Levels 3 and 4, wire by pointing at a pin and pinching (direct touch on the small pins is not supported yet).

## Run it locally

Requirements: Node.js 20.19+, 22.12+ or 24+, and npm.

```bash
git clone https://github.com/Mwaisaks/robotics-lab.git
cd robotics-lab
npm install          # .npmrc skips the optional onnxruntime CUDA download
npm run dev          # managed dev server + browser (IWSDK CLI)
```

- Checks: `npm run typecheck && npm test && npm run build` (also `npx tsc --noEmit -p api` and `npx tsc --noEmit -p dashboard`).
- Production build: `npm run build`, then `npx vite preview` (app at `/`, dashboard at `/dashboard/`).
- AI hints and sync run as Vercel functions in `api/`. They need these environment variables (server-side only, never in the browser): `LLM_API_KEY` (Gemini API), `SUPABASE_URL`, `SUPABASE_ANON_KEY`; optional `HINT_MODELS`, `HINT_RATE_LIMIT`, `CLASS_RATE_LIMIT`. See `.env.example` and `docs/data.md` (database schema). Without them the app still runs with built-in hints and no sync.
- Vercel settings: framework Vite, Node 22.x, build `npm run build`, output `dist`, env var `npm_config_onnxruntime_node_install_cuda=skip`.

## How to play

- **Browser:** open the live link, enter a class code and nickname (or play as guest), press PLAY IN BROWSER, choose a level. Drag parts with the mouse or a finger; tap buttons and terminals.
- **Headset (Meta Quest):** open the live link in the Quest Browser, press ENTER VR, put the controllers down and use your hands: pinch to grab, poke or pinch to press.
- **Teacher:** open `/dashboard/` and enter the class code.

## Technologies

- TypeScript, Vite, Vitest
- [Immersive Web SDK](https://developers.meta.com/vr/documentation/iwsdk/) (`@iwsdk/core`, CLI, Vite plugin) on three.js (`super-three`), WebXR, hand tracking
- `@pmndrs/uikit` (in-world UI panels), Lucide icons via `@pmndrs/uikit-lucide`
- Gemini API (AI hints, via a Vercel function)
- Supabase (Postgres with row-level security; anonymous insert, class read through an RPC)
- Vercel (hosting, serverless functions, preview deployments), GitHub Actions (CI), GitHub Pages (fallback)

### Dependencies

Runtime: `@iwsdk/core` 1.1.0, `three` (as `super-three` 0.185.0), `@pmndrs/uikit`, `@pmndrs/uikit-horizon`, `@pmndrs/uikit-lucide`.
Development: `@iwsdk/cli`, `@iwsdk/vite-plugin-dev`, `@iwsdk/reference`, `@meta-quest/metavr`, `typescript`, `vite`, `vitest`, `@types/three`.
The Gemini and Supabase calls use plain `fetch` (no extra client libraries).

## External resources and credits

- **Immersive Web SDK** by Meta (MIT): the starter scaffold, editor tooling and runtime this app is built on.
- **three.js** (MIT) and **pmndrs uikit** (MIT); icons from **Lucide** (ISC).
- **Gemini API** by Google: AI hint text (server-side).
- **Supabase**: database for class progress.
- **Vercel**: hosting and serverless functions.
- **Uno-style board** in Level 4 is a simplified model inspired by the Arduino Uno layout; no brand names are shown in the app.
- **Sounds:** original, synthesized by `tools/make_sounds.py` (see `public/audio/LICENSE.md`).
- 3D models, the lab room and all level scenes are built procedurally in code; no third-party models or textures.
- AI coding assistants were used by the team during the build; every change went through pull requests, CI and review.

## Team

| Person | Role |
|---|---|
| **Phenny Mwaisaka** | Team leader, software engineer, QA |
| **Joshua Mumo** | Robotics engineer, content lead, Quest tester |
| **Rebecca Okoko** | ML engineer, AI tutor and data |

## Repository map

- `src/core/` pure game logic and learning events (unit-tested in `tests/`)
- `src/` level systems (headset + browser), `src/web/` browser input, `src/shell/` start screen, i18n, hint panel
- `src/tutor/` Robo and sync; `api/` Vercel functions; `dashboard/` teacher page
- `docs/BRIEF.md` project brief, `docs/activities/` level specs and mistake codes, `docs/STATUS.md` team status
- `AGENTS.md`, `SETUP.md`, `agents/` team and agent rules

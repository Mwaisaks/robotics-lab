# AGENTS.md — Robotics Lab (read this first, every session)

## What this is
Robotics Lab: a hands-on robotics learning app for secondary school students in Kenya (Machakos Hackfest, Education track).
Levels: 1 Sort the parts, 2 Program the robot, 3 Light it up (+ P2: Control the arm).
This repo STARTS FROM A DECLARED BASELINE (tag `baseline`: our 18 Nov Robot Arm Lab prototype). Everything after it is MksU Hackfest work.
Hackfest goals tonight: learning events + mistake codes, BROWSER MODE (mouse/touch, no headset), Robo tutor (built-in + AI hints),
class code + teacher dashboard, Vercel deploy, Level 2 upgrade, Kiswahili, offline PWA, read-aloud.
Team: Phenny (lead, integrator, QA), Joshua (robotics, content, Quest tests), Rebecca (online: AI + data).
Two modes from ONE codebase: headset (Meta Quest via Immersive Web SDK, hands only) and browser (mouse/touch).
AI tutor "Robo" explains mistakes (English + Kiswahili). Teacher dashboard shows class progress.
Full context: docs/BRIEF.md. Your role: agents/<your-role>.md. Activity rules: docs/activities/*.md. Live state: docs/STATUS.md.

## Timeline (EAT) — the clock wins over features
**Submission closes Fri 6:00am EAT.** Team checkpoints (ours, not organiser gates): 11:30pm Quest test (all levels + Robo) ·
12:30am Rebecca's final PR merged + tag demo-1 · no new features after 1:30am · 2:30am Quest test + regression + tag demo-2 ·
FEATURE FREEZE 3:00am · README/slides/footage 3:00-4:30am · SUBMIT 4:30-5:00am · buffer to 6:00am.
Run `TZ=Africa/Nairobi date` at the start of every report and say how long until the next checkpoint.

## Hard rules
1. Stay in your role's folders (agents/<role>.md). To touch another folder, src/core/events.ts or src/shared3d: STOP and ask your human.
2. src/core/** is PURE TypeScript: no three.js, IWSDK, DOM or network imports. Every rule there has a Vitest test in tests/.
3. Never invent Immersive Web SDK (IWSDK) APIs. Read https://developers.meta.com/vr/documentation/iwsdk/ and node_modules/@iwsdk/* types first; cite what you used.
4. Headset mode is HANDS ONLY (no controller-only input). Browser mode: every action works with mouse AND touch.
5. No secrets in code or commits. Keys live in Vercel env vars; the client calls /api/*. Keep .env out of git.
6. No brand names in the app UI (no "Arduino", "ESP32"). Simplified simulations say so on screen.
7. No student personal data: nicknames + class codes only.
8. Headset budget: >= 72 fps on Quest 3/3S, <= 100 draw calls, textures <= 1024px, download < 10 MB.
9. UI text: max 5 words per instruction, big buttons, in front of the user. All strings via src/shell/i18n.ts (en + sw).
10. Emit LearningEvents from src/core/events.ts for start, actions, mistakes (codes from the activity spec) and completion.
11. Don't rewrite working baseline code. Extend it; if a baseline file must change a lot, say why in the PR. Never rewrite git history (no force-push, no amend on pushed commits): the commit log is our proof of Hackfest work.
12. Smallest working version first. No features outside BRIEF/your role file without asking your human.

## Coordination protocol
- **Only Phenny's agent merges to main.** Everyone else opens PRs and never merges (not even their own).
- **Shared files (only Phenny's agent edits them):** `src/core/events.ts`, `src/shell/**` (incl. `src/shell/i18n.ts`), `package.json` + `package-lock.json`, `.github/**`, `AGENTS.md`, `SETUP.md`, `docs/BRIEF.md`, `vite.config.ts`, `iwsdk.config.json`. Need a change there? Write it under **"Needs from integrator"** in your PR instead of editing.
- **Before any task:** `git pull origin main`; `gh issue list --assignee @me`; check open PRs for files you will touch: `gh pr list`, then `gh pr diff <n> --name-only`. Overlap with someone else's PR -> STOP and tell your human.
- **One issue per task.** Branch `feat/<area>-<issue#>-<name>` (or `fix/...`); PR body says `Closes #<issue#>`. No issue yet? Ask your human to create one.
- **Push = draft PR straight away:** `gh pr create --draft --fill` (the template adds the sections), then `gh pr ready` when CI passes.
- **Before marking ready, bring your branch up to date with main.** Rebase only commits you have not pushed yet (`git pull --rebase origin main` before your first push). Once a branch is pushed, use `git fetch origin && git merge origin/main`: never force-push, never rewrite pushed history, never push to main.

## Workflow for every task
1. Restate the task, list files you'll change.
2. Follow the coordination protocol above: pull main, check your issue and open PRs, branch `feat/<area>-<issue#>-<name>`.
3. Core logic + tests first, then renderer(s).
4. `npm run typecheck && npm test && npm run build` must pass.
5. Test in browser mode (PR preview link). If you touched src/xr, list what must be checked on the Quest.
6. Small commits, plain present-tense messages. No Co-Authored-By or AI attribution trailers.
7. Draft PR on first push (template: What / Why, Closes #, Files touched, How to test, Integration notes, Needs from integrator); mark ready when CI passes. Phenny's agent merges; aim to be merge-ready within ~3 hours of starting the branch.
8. Update your line in docs/STATUS.md. Report to your human in 3-5 lines: works / doesn't / needs testing.

## When unsure
Say so, check docs or code, or ask your human. A small thing that works beats a big thing that crashes.

## IWSDK framework notes (kept from the prototype's IWSDK guide)
This is a Vite + TypeScript app, but several things are NOT standard Vite:
- `iwsdk.config.json` is the project authority (active scene, asset/component modules, XR/world features). `vite.config.ts` only wires the plugin.
- `virtual:iwsdk-project` is a virtual module: `src/index.ts` imports it and passes it whole to `World.create()`. Don't hand-build that object.
- The dev server is CLI-managed: `npm run dev` (or `npx @iwsdk/cli dev up`), not plain `vite`. Check `npx @iwsdk/cli dev status` before browser-backed commands.
- `src/assets.ts` runs twice (app + editor): deterministic, side-effect free (no World, DOM, timers).
- Static geometry lives in TypeScript; scene JSON (`public/scenes/`) holds composition only, via manifest IDs.
- Components are declared in system-free modules and exported from `src/components.ts` via `defineComponents()`.
- Import Three.js from `@iwsdk/core`, never from `three` (duplicate instance breaks things).

Traps: use `entity.dispose()` not `destroy()` (GPU leak) · Vec/Color fields: `entity.getVectorView(...)`, not `setValue` · `ScreenSpace` takes CSS strings (`'400px'`) · `locomotion: true` needs a `LocomotionEnvironment` floor · scene JSON with `imports` must be flattened (`npx @iwsdk/cli scene flatten`).

Conventions: systems use queries, not hand-kept entity arrays · never allocate in `update()` (allocate in `init()`) · prefer `queries.x.subscribe('qualify', ...)` over polling · register teardowns in `this.cleanupFuncs` · `signal.peek()` in `update()` · load assets via `AssetManager`/manifest, not raw `GLTFLoader` · create entities with `world.createTransformEntity(...)`, not `scene.add()` · in XR code use `RayInteractable`, not a manual `Raycaster` · no barrel `index.ts` files.

Verify: run `npm run typecheck` before testing (type errors can silently stop systems). The editor render does not run systems, so check system-driven behaviour with a runtime screenshot. Pose/hand claims need an active XR session (`npx @iwsdk/cli xr status`) or a real Quest.

Skills (`.claude/skills/`, `.agents/skills/`): start with `iwsdk-dev`; models → `iwsdk-build-model`; scene layout → `iwsdk-compose-scene`; Quest over USB → `iwsdk-native-xr-test`; also ui, grab, ray, physics, debug, hosting, pwa-packaging. Don't hand-author scene JSON, models, UIKitML panels or physics bodies without the owning skill. Scoped rules: `.claude/rules/`. IWSDK testing guide: https://iwsdk.dev/guides/02-testing-experience.html

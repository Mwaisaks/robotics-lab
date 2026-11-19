# SETUP — start here (Robotics Lab, MksU Hackfest 2026)

**Teammates:** follow this file top to bottom. It takes about 20 minutes.
**AI agents:** if a human pointed you here, read this file, then `AGENTS.md`, `docs/BRIEF.md`, and the person's role file in `agents/`. Then follow that role file's "Deliverables in order", starting from the first one not yet done (check `docs/STATUS.md` and `git log`).

---

## 0. What we're building (30-second version)
Robotics Lab is a hands-on robotics learning app for secondary school students in Kenya.
- **Levels:** 1 Sort the parts, 2 Program the robot, 3 Light it up.
- **Two modes:**
  - **Headset:** Meta Quest, hands only, mixed reality.
  - **Browser:** laptop or phone, with mouse or touch.
- **Robo:** an AI tutor that explains mistakes in English and Kiswahili.
- **Teacher dashboard:** shows each class's progress.

The repo starts from our 18 Nov prototype, which is tagged `baseline` and declared as prior work. Everything after that tag is Hackfest work. Full details are in `docs/BRIEF.md`.

## 1. Who does what

| Person | Role file | Owns |
|---|---|---|
| Phenny (on site) | `agents/phenny-integrator.md` | Repo, Vercel, events, **browser mode**, menu/shell, Kiswahili plumbing, offline, README, merges |
| Joshua (on site) | `agents/joshua-robotics.md` | Activity specs, **mistake codes + hint text**, **Level 2 upgrade**, Quest tests, footage |
| Rebecca (online) | `agents/rebecca-ai.md` | **Robo tutor** (built-in + AI hints), `/api/hint`, Supabase, **teacher dashboard** |

## 2. Timeline (EAT, Thu 19 → Fri 20 Nov)

| Time | What must be true |
|---|---|
| 5:00pm (gate G0) | The baseline is live on Vercel and everyone has the repo running |
| 6:30pm | Learning events and mistake codes are live in Levels 1–3, so Rebecca can switch from mock to real events |
| 9:00pm (gate G1) | Robo built-in hints in all levels; Level 1 plays in the browser; `/api/hint` works |
| 12:30am (gate G2) | All levels in the browser and on the Quest; the dashboard shows a test class; tag `demo-1` |
| 2:00am | No new features start after this. README draft done. |
| **4:00am** | **FEATURE FREEZE:** bug fixes only |
| **7:00am** | **SUBMITTED** (submissions close at 8:00am) |

Each gate is a short voice call. Rebecca joins online.

## 3. Install (once)
You need:
- **Node.js** 20.19+, 22.12+ or 24+. Check with `node -v`.
- **git**
- **GitHub CLI** (`gh`), logged in with `gh auth login`
- your AI coding agent (e.g. Claude Code)

Accept the GitHub invite to the repo **robotics-lab** (Phenny sends it). Then:

```bash
git clone https://github.com/Mwaisaks/robotics-lab.git
cd robotics-lab
npm install
```

- **If `npm install` fails while downloading CUDA files for `onnxruntime-node`,** run this instead:
  ```bash
  npm install --onnxruntime-node-install-cuda=skip
  ```
  The repo's `.npmrc` should already set this.
- **Check everything works:**
  ```bash
  npm run typecheck
  npm run build
  npm run dev        # prints a Local and a Network URL (https://…:8081 or similar)
  ```
- **Open the Local URL in Chrome.** Accept the certificate warning (it's a local self-signed certificate).

## 4. Secrets (Rebecca, and anyone calling the API locally)
- Copy `.env.example` to `.env.local` and fill in the keys Rebecca shares **privately** (never in the chat history of a public channel).
- **Never commit `.env` or `.env.local`.** Production keys live only in Vercel's environment variables, which the account owner sets.

## 5. Start your agent
Open your agent **inside the `robotics-lab` folder** and give it the **"First prompt"** at the bottom of your role file. For example, Joshua:

> Read SETUP.md, AGENTS.md, docs/BRIEF.md and agents/joshua-robotics.md. Help me write docs/activities/program.md and the mistake-code table from my notes: [paste]. Then build the Level 2 upgrade core with tests.

**Rules your agent must follow** (all in `AGENTS.md`):
- stay in your own folders
- `src/core` is pure logic with tests
- don't invent Immersive Web SDK APIs
- hands-only in headset mode; mouse **and** touch in browser mode
- no secrets in code
- no brand names in the app
- short commits with no AI co-author trailers
- never rewrite pushed history

## 6. Daily loop (every task)
```bash
git checkout main && git pull
git checkout -b feat/<area>-<short-name>      # e.g. feat/program-repeat-block
# … work with your agent …
npm run typecheck && npm test && npm run build
git push -u origin HEAD
gh pr create --fill                            # then add: how to test + screenshots
```

- **Vercel** posts a **preview link** on every PR. Test there with mouse **and** a phone.
- **Phenny** reviews and merges PRs (with the `reviewer` subagent). **Rebecca** reviews Phenny's PRs.
- **Keep branches small:** merge within about 2 hours.
- **Update your line in `docs/STATUS.md`** every 2 hours, and post in the team chat when you start or finish a branch.
- **Running two agents on one laptop?** Give each its own folder:
  ```bash
  git worktree add ../rl-<task> -b feat/<area>-<task>
  ```

## 7. Testing on the Quest (Joshua + Phenny)
- **Easiest:** open the Vercel live link, or a PR's preview link, in the **Quest Browser**, then tap **Enter XR**. Add `?debug=1` to show FPS.
- **Local dev server:** put the Quest on the same Wi-Fi and open the **Network** URL from `npm run dev`. Accept the certificate warning.
- **Before testing:** put the controllers away, turn the room lights on, and mark your table in the Quest's room setup (Settings → Physical space → Space setup).
- **Report test results as one line each:** `Level/test → PASS or FAIL → what you saw`.

## 8. Helpers (Claude Code)
- **Before merging:** `Use the reviewer subagent on PR #<n>`
- **After writing core rules:** `Use the test-writer subagent for src/core/<area>`

## 9. If you're stuck
- **Blocked for more than 30 minutes?** Say so in the team chat right away.
- **The build is broken on `main`?** Tell Phenny, and don't merge anything else until it's fixed.
- **Not sure if something is in scope?** Check the priority table in `docs/BRIEF.md` ("Hackfest work"). Do P0, then P1, then P2.

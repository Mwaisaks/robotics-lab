# CONTEXT: Meta VR Start Developer Competition 2026

Read this first, then read `plan.md` and follow it step by step.

## Situation
- Competition: Meta VR Start Developer Competition 2026 (Devpost): https://start-developer-competition-26.devpost.com/
- **Deadline: Wed Nov 18, 2026, 12:00pm PST = 11:00pm Nairobi (EAT).** Submit by 9:00pm EAT at the latest.
- Nothing is built yet. The only work so far: Meta VR Start program application done, Devpost joined, quickstart tutorial partly watched.
- Goal: a SIMPLE, polished, demoable prototype that scores well with judges. A small thing that works beats an ambitious thing that crashes.
- Builder: Phenny (lead dev, team representative, makes the single Devpost submission). Based in Nairobi time (UTC+3). Experienced in Java/Spring Boot, JavaScript/React web, Kotlin/Android, QA. New to VR/WebXR.
- Teammates (Tukuze Afrika, both robotics experts): Mike and Joshua. They split roles between themselves: (a) concept/experience design and robotics rules, (b) assets, playtesting, demo video and Devpost write-up.
- Phenny builds with Claude Code in the terminal. Hardware: Phenny HAS a Meta Quest headset. Use the browser XR emulator for fast iteration, but test on the Quest at every gate (hand tracking, passthrough, 60fps). Record demo footage from the headset.
- Step 0 status: Devpost team invites sent to Mike and Joshua. Rules spec (docs/rules.md) requested from them; if it's missing when needed, use the default rules in plan.md Step 3.

## Hard competition requirements
- Fully **hands-first**: finishable without controllers.
- Targets Meta VR devices (Quest / Meta VR Glasses). Tracks: Entertainment, Gaming, Productivity. Divisions: New Experience, or Adapted/Significantly Updated.
- Design for seated use, a fast start, a satisfying session under 10 minutes. Not a thin wrapper around an existing service.
- 60 fps minimum on Quest. Correct use of hand tracking, and purposeful passthrough/mixed reality where it makes sense.
- Submission: playable build or hosted link (WebXR), demo video **under 3 minutes with real gameplay footage (no AI-generated video)**, and the Devpost form. Verify exact fields on the Devpost rules/submission tabs.
- Must be a Meta VR Start member. One entry per person (team representative submits).

## Judging (4 criteria, 25% each)
1. Innovation & Creativity
2. Experience Design (purposeful passthrough, UI that works in a narrow field of view)
3. Technical Implementation (60fps, hand tracking, passthrough/scene features used correctly)
4. Polish & Presentation (demo video quality, real footage)

2025 winners (e.g. Tiny Golf, DreamSpace, Inkphony) were simple, tactile ideas with an instantly clear hook that used hands and the room.

## Technical decision
- **Immersive Web SDK (IWSDK)**: TypeScript/JavaScript, Three.js, Vite, Entity Component System (ECS). No game engine install. Browser-based XR emulation works with no headset.
- Not using Unity or Unreal. (A Unity Hub signing key may have been saved at /etc/apt/keyrings/unityhub.gpg; harmless, no Unity installed.)
- Docs (read these, do not guess APIs):
  - Project setup: https://developers.meta.com/vr/documentation/iwsdk/guides/01-project-setup/
  - Project manifest: https://developers.meta.com/vr/documentation/iwsdk/guides/01a-project-manifest/
  - Minimal scene: https://developers.meta.com/vr/documentation/iwsdk/guides/01b-minimal-scene/
  - Testing experience: https://developers.meta.com/vr/documentation/iwsdk/guides/02-testing-experience/
  - Working in 3D: https://developers.meta.com/vr/documentation/iwsdk/guides/03-working-in-3d/
  - External assets: https://developers.meta.com/vr/documentation/iwsdk/guides/04-external-assets/
  - Environment and lighting: https://developers.meta.com/vr/documentation/iwsdk/guides/05-environment-lighting/
  - Built-in interactions: https://developers.meta.com/vr/documentation/iwsdk/guides/06-built-in-interactions/
  - Custom systems: https://developers.meta.com/vr/documentation/iwsdk/guides/07-custom-systems/
  - Build and deploy: https://developers.meta.com/vr/documentation/iwsdk/guides/08-build-deploy/
  - Examples: https://developers.meta.com/vr/documentation/iwsdk/examples/
  - Troubleshooting: https://developers.meta.com/vr/documentation/iwsdk/troubleshooting/
  - Repo: https://github.com/facebook/immersive-web-sdk
- Setup facts: Node 20.19+ (or 22.12+, or 24+). Create with `npm create @iwsdk@latest`; choose **Mixed reality / passthrough** and **Customize setup** (enable grabbing, physics, room surfaces/anchors if offered). Run `npm run dev` and use the printed URL (the port can change). Other scripts: `npm run dev:status`, `npm run dev:down`, `npm run build`, `npm run preview`, `npm run typecheck`. The generated starter includes a robot example (`robot.ts`, `robot-component.ts`), `iwsdk.config.json`, a scene file `public/scenes/main.iwsdk.scene.json`, and a welcome UI `public/ui/welcome.uikitml`.

## Proposed concept (to confirm with Mike and Joshua): "Robot Arm Lab"
A mixed-reality tabletop robotics practice game. A small robot arm and a few colored parts sit on the player's real table through passthrough. Using only hands (pinch and grab), the player moves parts to the matching bins within 60 seconds. Sound and a score give feedback. The robotics expertise (joint limits, reach, correct placement rules, scoring) comes from Mike and Joshua. This is a robotics-practice idea for learners, and it fits Tukuze Afrika's school tech mentorship work.

## Story and pitch
Track: **Gaming, New Experience**. Framing: a casual, hands-first puzzle game with a robotics theme. Lead with the game; the education story is the "why". Honest claim: **"a first step toward robotics practice for learners."** Draft Devpost text lives in `docs/story.md`.

### The story (for the judges)
- We are three trainers from **Tukuze Afrika**: Phenny, Mike and Joshua. We teach secondary school students in Meru County through a program with **CSA Africa**. Phenny teaches programming; Mike and Joshua teach robotics.
- We teach at **Ngine Secondary** (Kaithe, near Meru) and **Burieruri** (Maua).
- The program exists so students get early exposure to technology and build their own solutions instead of depending on foreign ones.
- **The gap:** robotics is hands-on, but equipment is limited.
- **Our idea:** let a student practice robotics thinking (reach, limits, placing parts correctly) with only their hands, on their own table.
- **That became Robot Arm Lab:** a mixed-reality tabletop game where you move parts into the right bins with your hands while a robot arm reacts. (Arm shipped in Step 4; reviewed by Joshua.)
- Optional personal line for the video [confirm: Phenny wants to include it]: Phenny had no exposure to technology until university and didn't know how to use a computer before then, and wants students to touch the future sooner.
- **What's next:** any prize money would go toward inspiring young African robotics champions.

### 60-second spoken version (about 150 words)
> We're Phenny, Mike and Joshua, trainers with Tukuze Afrika. Through a program with CSA Africa, we teach secondary school students in Meru County, Kenya: Phenny teaches programming, Mike and Joshua teach robotics.
> Robotics is hands-on, but equipment is limited. So we asked: what if a student could practice robotics thinking (reach, limits, placing parts correctly) with nothing but their hands, on their own table?
> That's Robot Arm Lab. *(cut straight to the demo)* You sit at a real table, pinch a part and drop it in the matching bin. Right bin, ten points. Wrong bin, it comes back. Sixty seconds. The robot arm reaches for every part you pick up, and turns red when a part is out of its reach.
> It's a first step toward robotics practice for learners. Any prize money would go toward inspiring young African robotics champions.

### Things not to claim
- That students have already used or tested it.
- That it replaces a robotics lab, robotics kits or a teacher.
- That it teaches or certifies robotics skills; say "a first step toward robotics practice".
- Any feature not in the final build (robot arm reactions, reach limits, table detection, sound) unless it ships and works on Quest.
- That it is endorsed by, partnered with or funded by Meta, CSA Africa or the schools.
- No students or other identifiable people in the app or video (Official Rules: only the three entrants), and no corporate logos or brand names inside the app.
- Audience wording: say "secondary school students" or "young learners", never "kids" or "children".

## Working rules
- **Never add Claude as co-author or collaborator on git commits (no `Co-Authored-By` trailer).**
- Do not invent SDK APIs. Read the docs and the starter code first. If unsure, say so and check.
- Prefer the smallest thing that works. Cut scope before cutting polish.
- Everything must run from a hosted link without logins or special setup.

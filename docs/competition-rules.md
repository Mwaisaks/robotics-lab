# Competition rules and requirements (Meta VR Start Developer Competition 2026)

Source: Devpost Overview, FAQ, Judging and Special Awards pages, read 2026-11-18.
Official Rules (/rules) pasted in by Phenny on 2026-11-18; see "From Official Rules" at the end.

## Deadline
- **Wed Nov 18, 2026, 12:00pm PST = 11:00pm Nairobi (EAT).** Team target: submit by 9:00pm EAT.
- No changes to the app or the hosted link after the deadline until winners are announced (~Dec 11). The link must stay live through judging.
- The submission form and the app can be edited until the deadline.

## Hard requirements
- **Hands-first:** you must be able to finish the whole experience without pairing a controller. Controllers are optional.
- **Runs on Quest 3 / 3S.** Judges test on Quest 3 / 3S. Quest 2 and Pro aren't judged.
- **At least 60 fps on Quest, and bug-free.**
- **Passthrough entries:** must use scene understanding correctly and **work in rooms the developer didn't test**. The real room should meaningfully change the experience.
- **No third-party hardware** (no Bluetooth accessories).
- Follow Meta policies (Start Program Terms, Content Guidelines for 10+/13+/18+, Code of Conduct in VR).
- **Original work:** third-party assets and code must be used under their licenses. No thin wrappers around other services.
- Entrant (or a team member) must be a Meta VR Start member with Developer Access active by submission time. Kenya is not on the excluded list.
- One entry per person. The Team Representative submits. A representative can't also enter solo.

## Design guidelines (scored, not mandatory)
- **Seated, "airplane seat test":** every interaction within roughly a 2-foot radius.
- **Easy in and out, "one bus stop test":** fast cold start, clean pause/resume, a payoff in 10 minutes or less.
- **"Take it away test":** the project still exists without any third-party service.

## Our choices
- **Build path:** IWSDK (WebXR). Submit as a hosted link (GitHub Pages).
- **Division:** New Experience. Built from scratch after Sep 24, 2026.
- **Track:** Gaming (suggested: top prize $100k vs $70k for Productivity). Confirm with the team.

## What to submit
1. **Playable build:** hosted HTTPS link (GitHub Pages). Judges "can't score what they can't launch."
2. **Demo video:**
   - under 3 minutes (judges may stop at 3:00, so lead with the strongest material)
   - real footage from a Quest or an emulator, no AI-generated video
   - **public** on YouTube or Vimeo
3. **Devpost form:**
   - Submission name
   - Tagline (max 140 characters)
   - Track
   - Division
   - Description (about 500 words or less): inspiration, how it was built, future plans
   - Optional: how hand interactions are implemented; what excites us about VR's future
   - Target launch date (if not published)
   - Name, email and role for each team member (Phenny, Mike, Joshua)

## Judging (4 criteria, 25% each)
Stage 1 checks baseline requirements (theme, track, division, required tools). Stage 2 is expert scoring.
1. **Innovation & Creativity:** originality, ambition, fit with the track. Bonus for use of device features that encourages repeat use.
2. **Experience Design:** mechanics, user journey, intuitive navigation, **clear onboarding**. The real room should matter in passthrough.
3. **Technical Implementation:** reliability, hand tracking, passthrough, spatial anchoring, FoV-aware design, **60 fps**, no bugs, works in unfamiliar rooms.
4. **Polish & Presentation:** UI/UX, art direction, **sound**, performance, submission materials. The video should show real gameplay.

Ties are decided by a judges' vote. An entry can win only one prize (the highest it qualifies for).

## Special awards worth aiming at
- **Best First Five Minutes:** explains itself fast, teaches hand interaction without a wall of text, payoff before the headset comes off. Fits our short-round design.
- **Boldest Original Concept:** a core loop that depends on presence, real-world scale, or hands.
- (Others: Social/Multiplayer, Agentic Interaction, Reason to Come Back, Accessibility Forward, Judge's Choice. Not our focus.)

## Implications for our build
- **Table placement:** judges' rooms differ from ours. If we snap to a real table, it must fall back cleanly to a fixed seated spot when no table is detected. Never leave the player with nothing to play.
- **Performance:** check frame rate on the Quest before release.
- **Onboarding:** a 1-line instruction plus a visible first success in the first 10-15 seconds.
- **Sound:** explicitly scored. Keep Step 5 audio.
- **Video:** publish publicly on YouTube or Vimeo, not unlisted.
- **Freeze the app** after submitting. No pushes to main after 11:00pm EAT until judging ends.

## From Official Rules
Source: https://start-developer-competition-26.devpost.com/rules (text pasted by Phenny, 2026-11-18). Only items that are new or differ from the sections above.

### Dates
- Entry period ends **Nov 18, 2026, 12:00:00 PM PT**. Judging about Nov 18 to Dec 9. Winners announced about **Dec 11, 2026**.
- The project must **stay available, free of charge, until the Winner Announcement**. No changes to the submission after the Entry Period; judging uses its state at the deadline. It must "operate and function" consistently.

### Eligibility (differs from above)
- **Every** team member must be **18+** (and of age of majority) as of the start of the Entry Period.
- **Every** team member needs an active Meta account with **Developer Access** by submission time.
- Only the **Representative** (the person submitting) must be a **Meta VR Start member** by submission time. (Our Step 8 checklist asks all three to be Start members; that is stricter than required, but harmless.)
- Excluded: Brazil, Quebec, sanctioned areas (Crimea, Russia, Cuba, Iran, North Korea, Syria, OFAC list). Kenya is not excluded.
- Government and political officials are not eligible. One Entry per team, by its Representative; the Representative can't also enter solo.
- The project must not have received direct funding from Meta.

### Submission fields (Devpost)
- Link to the project: for IWSDK/WebXR, a link judges can open (GitHub Pages or another host).
- Demo video **under 3 minutes**, footage "as viewed on a Meta Quest device or via XR Simulator or another equivalent emulator", **publicly visible on YouTube or Vimeo**. Judges need not watch past 3:00.
- Text description: inspiration, how we built it, future plans, and a **target launch date** (if not on the Meta VR Store). Screenshots recommended.
- Track and Division selection. Meta may re-assign either.

### Content and IP
- **English** (or English subtitles) for the app and all materials.
- **No identifiable person other than the Entrants** in the project. Keep students out of the app and the video.
- **No commercial or corporate advertising**: no corporate logos, brand names, slogans, or recognizable branded products in the project. Must not imply any association between Meta and anyone else.
- Must be original, or public domain, or content Meta provided for the contest. Third-party tools, code and assets must be properly licensed; **Meta may ask for proof of license**. All 3D content is now procedural (built in our code); the IWSDK starter robot model was removed on 2026-11-18. Any added sound files get their licence noted next to them.
- Content must suit Meta's 10+/13+/18+ guidelines.
- We keep ownership of our project, but grant Meta a broad, perpetual license to use the entry and our names, voices, faces and likeness for the contest and marketing.
- Development tools must be publicly available or available to Start members. No rule against AI-assisted coding was found; the only AI note is on the video ("Don't lean on AI-generated video") and that judges may use AI tools to assist, with humans deciding.

### Judging details (new)
- Stage One is pass/fail: does it fit the theme and reasonably use the required tools and features.
- Technical Implementation names, for passthrough entries, **"correct use of scene understanding (MRUK), anchoring content to detected planes, surfaces, and room geometry, and holding up in rooms the developer never tested."**
- Innovation names **persistent anchors** and scene understanding as capabilities that drive repeat usage.
- Experience Design: **FoV-aware design**: keep essential UI and interactions within a comfortable, narrower field of view.

### Prizes
- Best New Gaming Experience: $100,000 winner, $50,000 runner-up. One prize per Entry.
- Paid to the Representative, who splits it with the team. A bank account may be needed for prizes of $1,000 or more; non-US winners get IRS Form 1042-S and US tax may be withheld.

### Implications for us
- **Team name in the app:** decided 2026-11-18: "TUKUZE AFRIKA" removed from the in-app welcome panel (strict reading of the "no brand names" rule). The team name stays in the Devpost text and video only.
- **Video:** only Phenny, Mike and Joshua on camera or named; no students. CSA Africa and the schools can be named in Devpost text as context, without implying their endorsement.
- **Scene understanding (Step 3b) is explicitly judged** for passthrough entries, so it is worth doing, with the fallback.
- **Keep the GitHub Pages link live and unchanged until about Dec 11.** Don't push to `main` after the deadline (each push redeploys).
- **Target launch date** must be in the description.
- **UI within a narrow FoV**: keep the game panel near the center, close to the play area.

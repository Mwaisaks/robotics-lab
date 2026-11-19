# Role: AI tutor "Robo", data & teacher dashboard — Rebecca (online)

## Mission
On every mistake Robo explains WHY in 1-2 short sentences (English or Kiswahili), instantly from built-in hints and better from AI when online. Teachers see class progress. Measurable impact numbers for the pitch.

## You own
src/tutor/** (hint lookup, panel hook, AI client with 3 s timeout + cache) · api/hint.ts, api/progress.ts (if needed) · dashboard/** · docs/data.md (Supabase schema) · P2 src/core/adaptive.ts. Joshua writes the hint TEXT; you own the loader/format.

## Deliverables in order (EAT)
1. 4:00-5:00pm: docs/data.md: table events(class_code, nickname, activity, type, code, stars, seconds, created_at) with anonymous insert-only access + read for the dashboard by class code; choose the LLM provider; give keys to the Vercel owner (env vars only, never in client or git); api/hint.ts skeleton.
2. 5:00-9:00pm (checkpoint 9:00pm): build against a MOCK event stream until Phenny posts "events live" (~6:30pm). Built-in hint lookup (activity + code + lang -> text) with Vitest tests; hint panel hook usable from both renderers (agree the call with Phenny: e.g. showHint(text) on the shell); api/hint.ts: HintRequest -> LLM -> HintResponse (max 2 short sentences, simple words, requested language, encouraging, no personal data sent), 3 s timeout -> built-in fallback, simple rate limit.
3. 9:00pm-12:30am (checkpoint 12:30am): AI hints live in the app (test on PR preview links); progress sync: activity_completed + mistake events -> Supabase with class code + nickname (queue offline, flush later).
4. 12:30-4:00am: dashboard page: enter class code -> nicknames x levels (stars, time) + top 3 mistake codes with plain-English meaning; seed a demo class; Kiswahili hint review with Joshua. P2 adaptive difficulty only if P1 done. No new features after 4:00am.
5. 4:00-6:00am: bug fixes; dashboard screenshots. 6:00am FREEZE.
6. 6:00-8:00am: slides final: how Robo + data work, privacy (nicknames only, no PII), impact metrics. 8:00-9:00am: check the dashboard on the live link while Phenny submits.

## Safety
System prompt: age-appropriate, on-topic (the level and mistake only), encouraging, max 2 sentences; replace off-topic/unsafe output with the built-in hint. Never send nicknames to the LLM.

## First prompt
"Read AGENTS.md, docs/BRIEF.md and agents/rebecca-ai.md. Write docs/data.md, then the built-in hint lookup with tests, then api/hint.ts with timeout and fallback."

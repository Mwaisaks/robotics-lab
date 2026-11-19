/**
 * Robo, the tutor hook. Listens to the learning-event bus and, on every mistake:
 * 1. shows the built-in hint at once (offline-safe) and emits hint_shown 'builtin';
 * 2. asks /api/hint in the background; if an AI answer arrives within 3 s and no
 *    newer mistake has happened, replaces the text and emits hint_shown 'ai'.
 * Attempts are counted per activity+code (reset when that activity starts again).
 *
 * Usage (browser mode, default DOM hint box):  startTutor({ lang: 'en' })
 * Headset mode: pass `show` to draw the hint on an in-world panel instead.
 */
import { events as appEvents, type ActivityId, type EventBus } from '../core/events.js';
import { fetchAiHint } from './ai-client.js';
import { HINT_TIMEOUT_MS } from './ai-hint.js';
import { builtinHint, type HintRequest, type Lang } from './hints.js';
import { showHintBox } from './hint-box.js';

export type HintSource = 'builtin' | 'ai';
/** Draws the hint. Called with the built-in text first, then possibly again with the AI text. */
export type ShowHint = (text: string, source: HintSource) => void;

export interface TutorOptions {
  /** Current language, or a getter so a language toggle takes effect on the next hint. */
  lang: Lang | (() => Lang);
  /** Where to draw the hint. Default: the DOM hint box (browser mode only). */
  show?: ShowHint;
  bus?: EventBus;
  /** AI hint source; default calls /api/hint. Return null for "no AI answer". */
  fetchHint?: (req: HintRequest) => Promise<string | null>;
  now?: () => number;
  /** AI answers arriving later than this are ignored (the built-in hint stays). */
  aiTimeoutMs?: number;
}

export interface Tutor {
  /** How many times this mistake happened since the activity (re)started. */
  attempts(activity: ActivityId, code: string): number;
  /** Unsubscribe; pending AI answers are ignored. */
  stop(): void;
}

export function startTutor({
  lang,
  show,
  bus = appEvents,
  fetchHint = (req) => fetchAiHint(req),
  now = Date.now,
  aiTimeoutMs = HINT_TIMEOUT_MS,
}: TutorOptions): Tutor {
  const getLang = typeof lang === 'function' ? lang : () => lang;
  const draw: ShowHint = show ?? ((text, source) => showHintBox(text, source, getLang()));
  const counts = new Map<string, number>();
  let latest = 0; // id of the newest mistake; older AI answers are dropped
  let stopped = false;

  const display = (activity: ActivityId, code: string, text: string, source: HintSource) => {
    try {
      draw(text, source);
    } catch (err) {
      console.error('[robo] show failed', err);
      return;
    }
    bus.emit({ type: 'hint_shown', activity, code, source, t: now() });
  };

  const off = bus.on((e) => {
    if (e.type === 'activity_started') {
      for (const key of [...counts.keys()]) if (key.startsWith(`${e.activity}|`)) counts.delete(key);
      return;
    }
    if (e.type !== 'mistake') return;

    const key = `${e.activity}|${e.code}`;
    const attempt = (counts.get(key) ?? 0) + 1;
    counts.set(key, attempt);
    const id = ++latest;
    const l = getLang();

    display(e.activity, e.code, builtinHint(e.activity, e.code, l), 'builtin');

    const started = now();
    const req: HintRequest = { activity: e.activity, code: e.code, attempt, lang: l, ...(e.detail ? { context: e.detail } : {}) };
    fetchHint(req)
      .then((text) => {
        if (!text || stopped || id !== latest || now() - started > aiTimeoutMs) return;
        display(e.activity, e.code, text, 'ai');
      })
      .catch(() => {}); // built-in hint already shown
  });

  return {
    attempts: (activity, code) => counts.get(`${activity}|${code}`) ?? 0,
    stop() {
      stopped = true;
      off();
    },
  };
}

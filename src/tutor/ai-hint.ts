/**
 * Pure logic behind /api/hint: request validation, the LLM prompt, output checks,
 * the 3 s timeout with built-in fallback, and a simple rate limiter.
 * No SDK, DOM or network here; api/hint.ts injects the actual LLM call.
 */
import { MISTAKE_CODES, type ActivityId } from '../core/events.js';
import { builtinHint, findBuiltinHint, type HintRequest, type HintResponse, type Lang } from './hints.js';

export const HINT_TIMEOUT_MS = 3000;
const MAX_CONTEXT_CHARS = 120;
const MAX_HINT_CHARS = 240;

const ACTIVITIES = Object.keys(MISTAKE_CODES) as ActivityId[];

/**
 * Turn an untrusted request body into a HintRequest, or null if it's invalid.
 * Only whitelisted fields survive, so a `nickname` or `classCode` sent by the
 * client never reaches the LLM. If a nickname is sent anyway, it is also
 * removed from `context`.
 */
export function parseHintRequest(body: unknown): HintRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;

  const activity = b.activity;
  if (typeof activity !== 'string' || !ACTIVITIES.includes(activity as ActivityId)) return null;
  const code = b.code;
  if (typeof code !== 'string' || !/^[A-Z_]{1,40}$/.test(code)) return null;
  const lang: Lang = b.lang === 'sw' ? 'sw' : 'en';
  const attempt = typeof b.attempt === 'number' && Number.isFinite(b.attempt) ? Math.min(99, Math.max(1, Math.floor(b.attempt))) : 1;

  const req: HintRequest = { activity: activity as ActivityId, code, attempt, lang };
  if (typeof b.context === 'string') {
    let context = b.context;
    if (typeof b.nickname === 'string' && b.nickname.trim() !== '') {
      context = context.split(b.nickname.trim()).join('');
    }
    // Game state only (e.g. "blocks: FORWARD x2, LEFT"); drop anything else.
    context = context.replace(/[^A-Za-z0-9 ,.:+()-]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_CONTEXT_CHARS);
    if (context) req.context = context;
  }
  return req;
}

const ACTIVITY_NAMES: Record<ActivityId, string> = {
  sort: 'Sort the parts (a robot arm picks parts and puts them in matching bins; it can only reach parts inside its workspace)',
  program: 'Program the robot (drive a robot on a grid to a star with FORWARD, BACK, LEFT, RIGHT and REPEAT blocks)',
  circuit: 'Light it up (a simplified circuit: battery, switch, resistor and LED wired in a loop)',
  build: 'Build the robot (snap wheels, motors and a controller board onto a chassis)',
  arm: 'Control the arm (move base, shoulder and elbow joints to reach targets)',
};

/** The model replies with this when it can't stay on topic; we then use the built-in hint. */
export const OFF_TOPIC = 'OFF_TOPIC';

/** Brand names are not allowed in the app (AGENTS.md rule 6). */
const BLOCKED_WORDS = /\b(arduino|esp32|raspberry|micro:?bit|lego)\b/i;

export const SYSTEM_PROMPT = [
  'You are Robo, a friendly robotics tutor inside a learning app for secondary school students in Kenya (age 12-18).',
  'A student just made a mistake in an activity. Explain WHY it went wrong and what to try next.',
  'Rules:',
  '- At most 2 short sentences, under 35 words in total. Simple words.',
  '- Reply only in the language asked for (English, or simple Kiswahili).',
  '- Be warm and encouraging. Never say the student is bad or wrong as a person.',
  '- Talk only about this activity and this mistake. No links, no brand names, no personal questions.',
  '- Do not just give the full answer; give the next step.',
  `- If you cannot give an on-topic hint, reply exactly ${OFF_TOPIC}.`,
  'Reply with the hint text only.',
].join('\n');

/** The user message for the LLM. Contains no nickname or class code. */
export function buildUserPrompt(req: HintRequest): string {
  const lines = [
    `Activity: ${ACTIVITY_NAMES[req.activity]}`,
    `Mistake code: ${req.code}`,
    `Attempt: ${req.attempt}${req.attempt >= 3 ? ' (the student is stuck, be more concrete)' : ''}`,
    `Language: ${req.lang === 'sw' ? 'Kiswahili' : 'English'}`,
  ];
  const known = findBuiltinHint(req.activity, req.code, 'en');
  if (known) lines.push(`Teacher's hint for this mistake (say it differently): ${known}`);
  if (req.context) lines.push(`Game state: ${req.context}`);
  return lines.join('\n');
}

/**
 * Accept the LLM text only if it looks like a short, safe hint. Returns the
 * cleaned text, or null to use the built-in hint instead.
 */
export function cleanHintText(raw: string): string | null {
  let text = raw.replace(/\s+/g, ' ').trim().replace(/^["']|["']$/g, '');
  if (!text) return null;
  if (text.includes(OFF_TOPIC)) return null;
  if (/https?:|www\.|@|<|>|\{|\}/i.test(text)) return null;
  if (BLOCKED_WORDS.test(text)) return null;
  // Keep at most 2 sentences.
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  text = sentences.slice(0, 2).join('').trim();
  if (text.length > MAX_HINT_CHARS) return null;
  return text;
}

/** The LLM call, injected by api/hint.ts. Must stop work when `signal` aborts. */
export type LlmCall = (system: string, user: string, signal: AbortSignal) => Promise<string>;

/**
 * Ask the LLM for a hint; on timeout, error or a rejected answer, return the
 * built-in hint. Never throws.
 */
export async function getHint(
  req: HintRequest,
  callLlm: LlmCall | undefined,
  timeoutMs: number = HINT_TIMEOUT_MS,
): Promise<HintResponse> {
  const fallback: HintResponse = { text: builtinHint(req.activity, req.code, req.lang), source: 'builtin' };
  if (!callLlm) return fallback;

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, timeoutMs);
  });
  try {
    const raw = await Promise.race([callLlm(SYSTEM_PROMPT, buildUserPrompt(req), controller.signal), timeout]);
    const text = raw === null ? null : cleanHintText(raw);
    return text ? { text, source: 'ai' } : fallback;
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fixed-window rate limiter: at most `limit` calls per key per `windowMs`.
 * In-memory, so on serverless it is per warm instance (best effort, enough to
 * stop one device spamming the LLM).
 */
export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const windows = new Map<string, { start: number; count: number }>();
  return function allow(key: string): boolean {
    const t = now();
    const w = windows.get(key);
    if (!w || t - w.start >= windowMs) {
      if (windows.size > 5000) windows.clear(); // keep memory bounded
      windows.set(key, { start: t, count: 1 });
      return true;
    }
    if (w.count >= limit) return false;
    w.count++;
    return true;
  };
}

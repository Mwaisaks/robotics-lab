/**
 * Rows for the Supabase `events` table (docs/data.md). Shared by the client
 * queue (src/tutor/sync.ts) and the server (api/progress.ts), so both apply the
 * same rules as the database CHECK constraints. Pure: no DOM or network.
 * Only a nickname and a class code identify a student; no other personal data.
 */
import { MISTAKE_CODES, type ActivityId, type LearningEvent } from '../core/events.js';

export interface Player {
  classCode: string;
  nickname: string;
}

/** One `events` row as sent to Supabase. Every column is always present (null if unused). */
export interface ProgressRow {
  class_code: string;
  nickname: string;
  activity: ActivityId;
  type: 'activity_completed' | 'mistake';
  challenge: number | null;
  code: string | null;
  stars: number | null;
  seconds: number | null;
  mistakes: number | null;
  client_t: number | null;
}

const ACTIVITIES = Object.keys(MISTAKE_CODES) as ActivityId[];

/** Upper-cased class code if valid (A-Z, 0-9, 4-8 chars), else null. */
export function normalizeClassCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  return /^[A-Z0-9]{4,8}$/.test(code) ? code : null;
}

/** Trimmed nickname if 1-20 characters with no control characters, else null. */
export function normalizeNickname(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim();
  const length = [...name].length; // count characters, like Postgres char_length
  // eslint-disable-next-line no-control-regex
  return length >= 1 && length <= 20 && !/[\u0000-\u001f\u007f]/.test(name) ? name : null;
}

function int(raw: unknown, min: number, max: number): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  const n = Math.round(raw);
  return n >= min && n <= max ? n : null;
}

/**
 * Validate an untrusted row and return a clean copy with ONLY the known
 * columns, or null if it would break a database rule.
 */
export function validateRow(raw: unknown): ProgressRow | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const class_code = normalizeClassCode(r.class_code);
  const nickname = normalizeNickname(r.nickname);
  if (!class_code || !nickname) return null;
  if (typeof r.activity !== 'string' || !ACTIVITIES.includes(r.activity as ActivityId)) return null;
  const activity = r.activity as ActivityId;
  const client_t = int(r.client_t, 0, Number.MAX_SAFE_INTEGER);

  if (r.type === 'mistake') {
    if (typeof r.code !== 'string' || !/^[A-Z_]{1,40}$/.test(r.code)) return null;
    return { class_code, nickname, activity, type: 'mistake', challenge: null, code: r.code, stars: null, seconds: null, mistakes: null, client_t };
  }
  if (r.type === 'activity_completed') {
    const challenge = int(r.challenge, 0, 32767);
    const stars = int(r.stars, 0, 3);
    const seconds = int(r.seconds, 0, 86400);
    const mistakes = int(r.mistakes, 0, 2147483647);
    if (stars === null) return null;
    return { class_code, nickname, activity, type: 'activity_completed', challenge, code: null, stars, seconds, mistakes, client_t };
  }
  return null;
}

/** Turn a learning event into a row for this player, or null if it isn't synced. */
export function eventToRow(event: LearningEvent, player: Player): ProgressRow | null {
  const who = { class_code: player.classCode, nickname: player.nickname, activity: event.activity, client_t: event.t };
  if (event.type === 'mistake') return validateRow({ ...who, type: 'mistake', code: event.code });
  if (event.type === 'activity_completed') {
    return validateRow({
      ...who,
      type: 'activity_completed',
      challenge: event.challenge,
      stars: event.stars,
      seconds: event.seconds,
      mistakes: event.mistakes,
    });
  }
  return null;
}

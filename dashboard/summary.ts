/**
 * Teacher dashboard: turn a class's `events` rows into the table and the top
 * mistakes. Pure: no DOM or network, so it is unit-tested (tests/dashboard).
 */
import { MISTAKE_CODES, type ActivityId } from '../src/core/events.js';
import { builtinHint } from '../src/tutor/hints.js';

/** A row as returned by /api/class (the Supabase `events` table). */
export interface ClassRow {
  nickname: string;
  activity: ActivityId;
  type: 'activity_completed' | 'mistake';
  challenge: number | null;
  code: string | null;
  stars: number | null;
  seconds: number | null;
  mistakes: number | null;
  created_at: string;
}

export interface Cell {
  /** Best stars over all completions of this level. */
  stars: number;
  /** Fastest completion time in seconds. */
  bestSeconds: number | null;
  completions: number;
}

export interface StudentRow {
  nickname: string;
  cells: Partial<Record<ActivityId, Cell>>;
  /** ISO time of this student's latest event. */
  lastActive: string | null;
}

export interface TopMistake {
  activity: ActivityId;
  code: string;
  count: number;
  /** How many different students made it. */
  students: number;
  meaning: string;
}

export interface ClassSummary {
  activities: ActivityId[];
  students: StudentRow[];
  topMistakes: TopMistake[];
  rowCount: number;
}

/** Levels 1-3 are always shown; later activities appear once someone plays them. */
const LEVELS: ActivityId[] = ['sort', 'program', 'circuit'];
const ALL: ActivityId[] = Object.keys(MISTAKE_CODES) as ActivityId[];

export const ACTIVITY_LABELS: Record<ActivityId, string> = {
  sort: '1 Sort the parts',
  program: '2 Program the robot',
  circuit: '3 Light it up',
  build: '3B Build the robot',
  micro: '4 Microcontroller lab',
  arm: 'Control the arm',
};

const later = (a: string | null, b: string | null) => (a === null ? b : b === null ? a : Date.parse(b) > Date.parse(a) ? b : a);

export function summarizeClass(rows: readonly ClassRow[]): ClassSummary {
  const students = new Map<string, StudentRow>();
  const mistakes = new Map<string, { activity: ActivityId; code: string; count: number; who: Set<string> }>();
  const played = new Set<ActivityId>();

  for (const r of rows) {
    if (!ALL.includes(r.activity)) continue;
    let s = students.get(r.nickname);
    if (!s) students.set(r.nickname, (s = { nickname: r.nickname, cells: {}, lastActive: null }));
    s.lastActive = later(s.lastActive, r.created_at ?? null);

    if (r.type === 'activity_completed' && typeof r.stars === 'number') {
      played.add(r.activity);
      const cell = (s.cells[r.activity] ??= { stars: 0, bestSeconds: null, completions: 0 });
      cell.completions++;
      cell.stars = Math.max(cell.stars, r.stars);
      if (typeof r.seconds === 'number' && (cell.bestSeconds === null || r.seconds < cell.bestSeconds)) cell.bestSeconds = r.seconds;
    } else if (r.type === 'mistake' && r.code) {
      const key = `${r.activity}|${r.code}`;
      const m = mistakes.get(key) ?? { activity: r.activity, code: r.code, count: 0, who: new Set<string>() };
      m.count++;
      m.who.add(r.nickname);
      mistakes.set(key, m);
    }
  }

  const topMistakes = [...mistakes.values()]
    .sort((a, b) => b.count - a.count || b.who.size - a.who.size || a.code.localeCompare(b.code))
    .slice(0, 3)
    .map(({ activity, code, count, who }) => ({ activity, code, count, students: who.size, meaning: builtinHint(activity, code, 'en') }));

  return {
    activities: ALL.filter((a) => LEVELS.includes(a) || played.has(a)),
    students: [...students.values()].sort((a, b) => a.nickname.localeCompare(b.nickname, 'en', { sensitivity: 'base' })),
    topMistakes,
    rowCount: rows.length,
  };
}

/** 95 -> "1:35", 3725 -> "62:05". */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '';
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 2 -> "★★☆". */
export function starString(stars: number): string {
  const n = Math.max(0, Math.min(3, Math.round(stars)));
  return '★'.repeat(n) + '☆'.repeat(3 - n);
}

/** ISO time -> "19 Nov, 21:05" in Kenya time (EAT, UTC+3). */
export function formatEat(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

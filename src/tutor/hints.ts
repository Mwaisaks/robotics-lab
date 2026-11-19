/**
 * Robo's built-in hints: activity + mistake code + language -> hint text.
 * Works offline and instantly. The AI tutor (/api/hint) falls back to this.
 * Hint TEXT lives in hints.<lang>.json (Joshua, from docs/activities/mistake-codes.md);
 * this file only loads and looks it up. Pure: no DOM, network or three.js.
 */
import type { ActivityId } from '../core/events.js';
import en from './hints.en.json' with { type: 'json' };
import sw from './hints.sw.json' with { type: 'json' };

export type Lang = 'en' | 'sw';

/** Request/response contract from docs/BRIEF.md ("Robo / AI tutor request"). */
export interface HintRequest {
  activity: ActivityId;
  code: string;
  attempt: number;
  lang: Lang;
  context?: string;
}
export interface HintResponse {
  text: string;
  source: 'builtin' | 'ai';
}

type HintTable = Partial<Record<string, Record<string, string>>>;

const TABLES: Record<Lang, HintTable> = { en, sw };

/**
 * Shown when no hint exists for a code (a new code, or an activity without hints yet).
 * TODO(Joshua): review wording; move to the JSON files if you prefer to own it there.
 */
export const GENERIC_HINT: Record<Lang, string> = {
  en: 'Not quite yet. Look closely and try one small change.',
  sw: 'Bado kidogo. Angalia kwa makini na ujaribu badiliko moja dogo.',
};

function isLang(lang: unknown): lang is Lang {
  return lang === 'en' || lang === 'sw';
}

/** The specific hint for this code, or undefined if the table has none. */
export function findBuiltinHint(activity: string, code: string, lang: Lang): string | undefined {
  const table = TABLES[lang];
  if (!Object.prototype.hasOwnProperty.call(table, activity)) return undefined;
  const codes = table[activity]!;
  if (!Object.prototype.hasOwnProperty.call(codes, code)) return undefined;
  const text = codes[code];
  return typeof text === 'string' && text.trim() !== '' ? text : undefined;
}

/**
 * Always returns a hint, never throws:
 * 1. the hint in the requested language,
 * 2. else the English hint for that code (a specific hint beats a generic one),
 * 3. else the generic hint in the requested language.
 * An unknown language is treated as English.
 */
export function builtinHint(activity: string, code: string, lang: Lang | string = 'en'): string {
  const l: Lang = isLang(lang) ? lang : 'en';
  return findBuiltinHint(activity, code, l) ?? findBuiltinHint(activity, code, 'en') ?? GENERIC_HINT[l];
}

/** Built-in hint shaped as a HintResponse (what the AI path falls back to). */
export function builtinHintResponse(req: Pick<HintRequest, 'activity' | 'code' | 'lang'>): HintResponse {
  return { text: builtinHint(req.activity, req.code, req.lang), source: 'builtin' };
}

#!/usr/bin/env node
/**
 * Seed the demo class DEMO1 for the teacher dashboard (pitch).
 *   node tools/seed-demo.mjs            insert the rows
 *   node tools/seed-demo.mjs --dry-run  print what would be inserted
 * Reads SUPABASE_URL (base URL, no /rest/v1) and SUPABASE_ANON_KEY from .env.local
 * (or the environment). The anon key can insert but not delete, so run it ONCE:
 * running it again adds a second copy of every row.
 * Nicknames are invented; no real students.
 */
import { readFileSync } from 'node:fs';

const CLASS_CODE = 'DEMO1';
const NICKNAMES = ['Zawadi', 'Baraka', 'Wanjiru', 'Otieno', 'Amina', 'Kipchoge', 'Neema', 'Juma'];

// Mistake codes per level, matching src/core/events.ts. Weights make the top 3 believable.
const MISTAKES = {
  sort: { OUT_OF_REACH: 5, WRONG_BIN: 3, DROPPED_OFF_TABLE: 1 },
  program: { HIT_WALL: 6, WRONG_TURN: 4, MISSED_GOAL: 3, HIT_OBSTACLE: 2, TOO_MANY_BLOCKS: 2, EMPTY_PROGRAM: 1 },
  circuit: { LED_REVERSED: 7, NO_RESISTOR: 4, OPEN_LOOP: 3, SWITCH_OFF: 2, SHORT_CIRCUIT: 1, LED_NOT_IN_LOOP: 1, SWITCH_NOT_IN_LOOP: 1 },
};

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && !line.trim().startsWith('#')) env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* no .env.local: use the environment */
  }
  return env;
}

// Small seeded PRNG so every run builds the same class.
let seed = 20261119;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const between = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
function pick(weights) {
  const entries = Object.entries(weights);
  let r = rand() * entries.reduce((s, [, w]) => s + w, 0);
  for (const [code, w] of entries) if ((r -= w) < 0) return code;
  return entries[0][0];
}

function buildRows() {
  const rows = [];
  const now = Date.now();
  const lessonStart = now - 60 * 60_000; // lesson began ~1 h ago
  NICKNAMES.forEach((nickname, i) => {
    const skill = [0.9, 0.6, 0.8, 0.4, 0.95, 0.7, 0.5, 0.3][i]; // a mix of strong and struggling students
    let t = lessonStart + between(0, 10) * 60_000;
    const levels = skill < 0.4 ? ['sort', 'program'] : ['sort', 'program', 'circuit']; // the weakest hasn't reached Level 3
    for (const activity of levels) {
      const challenges = activity === 'program' ? between(skill > 0.7 ? 4 : 2, 5) : 1;
      for (let challenge = 0; challenge < challenges; challenge++) {
        // Weaker students make more mistakes; Level 3 (polarity, resistor) trips up most of the class.
        const nMistakes = between(0, Math.round((1 - skill) * 7)) + (activity === 'circuit' && skill < 0.85 ? between(1, 2) : 0);
        for (let k = 0; k < nMistakes; k++) {
          t += between(15, 60) * 1000;
          rows.push(row({ nickname, activity, type: 'mistake', code: pick(MISTAKES[activity]), t }));
        }
        const seconds = Math.round((activity === 'program' ? 70 : 55) * (1.6 - skill) + between(0, 40) + nMistakes * 12);
        const stars = nMistakes === 0 ? 3 : nMistakes <= 2 ? 2 : 1;
        t += seconds * 1000;
        rows.push(row({ nickname, activity, type: 'activity_completed', challenge, stars, seconds, mistakes: nMistakes, t }));
        t += between(90, 360) * 1000; // reading, retrying, helping a neighbour
      }
    }
  });
  return rows.filter((r) => Date.parse(r.created_at) <= now);
}

function row({ nickname, activity, type, code = null, challenge = null, stars = null, seconds = null, mistakes = null, t }) {
  return { class_code: CLASS_CODE, nickname, activity, type, challenge, code, stars, seconds, mistakes, client_t: t, created_at: new Date(t).toISOString() };
}

async function main() {
  const rows = buildRows();
  const completed = rows.filter((r) => r.type === 'activity_completed').length;
  console.log(`Class ${CLASS_CODE}: ${NICKNAMES.length} students, ${rows.length} rows (${completed} completions, ${rows.length - completed} mistakes).`);
  if (process.argv.includes('--dry-run')) {
    // --all prints every row (pipe it to a file to inspect).
    console.log(JSON.stringify(process.argv.includes('--all') ? rows : rows.slice(0, 5), null, 2));
    return;
  }
  const env = loadEnv();
  const base = env.SUPABASE_URL?.replace(/\/+$/, '');
  const key = env.SUPABASE_ANON_KEY;
  if (!base || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY (in .env.local or the environment).');
    process.exit(1);
  }
  for (let i = 0; i < rows.length; i += 50) {
    const res = await fetch(`${base}/rest/v1/events`, {
      method: 'POST',
      headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', prefer: 'return=minimal' },
      body: JSON.stringify(rows.slice(i, i + 50)),
    });
    if (!res.ok) {
      console.error(`Insert failed at row ${i}: HTTP ${res.status} ${await res.text()}`);
      process.exit(1);
    }
  }
  console.log(`Done. Open the dashboard and enter ${CLASS_CODE}.`);
}

main();

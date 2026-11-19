/// <reference types="node" />
/**
 * POST /api/progress  (Vercel function)
 * Body: { rows: ProgressRow[] } (or a bare array), at most 50 rows.
 * Each row is validated (src/tutor/progress-rows.ts): known activity/type, nickname 1-20 chars,
 * class_code A-Z/0-9 4-8 chars (upper-cased), only the known columns. Invalid rows are dropped
 * and counted, so one bad row can never block a device's queue.
 * Valid rows are inserted into Supabase `events` over REST with plain fetch.
 * SUPABASE_URL (base URL, no /rest/v1) and SUPABASE_ANON_KEY stay on the server.
 *
 * Responses: 200 { inserted, rejected } · 400 bad body · 502/503 Supabase down or not configured
 * (the client keeps its rows and retries).
 */
import { validateRow } from '../src/tutor/progress-rows.js';

const MAX_ROWS = 50;
const SUPABASE_TIMEOUT_MS = 8000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }
  const raw = Array.isArray(body) ? body : (body as { rows?: unknown } | null)?.rows;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_ROWS) {
    return json({ error: `send 1-${MAX_ROWS} rows` }, 400);
  }

  const rows = raw.map(validateRow).filter((r) => r !== null);
  const rejected = raw.length - rows.length;
  if (rows.length === 0) return json({ inserted: 0, rejected });

  const base = process.env.SUPABASE_URL?.replace(/\/+$/, '');
  const key = process.env.SUPABASE_ANON_KEY;
  if (!base || !key) return json({ error: 'sync not configured' }, 503);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/rest/v1/events`, {
      method: 'POST',
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        prefer: 'return=minimal', // anon has no select permission
      },
      body: JSON.stringify(rows),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error('[progress] supabase insert failed', res.status, (await res.text()).slice(0, 300));
      return json({ error: 'insert failed' }, 502);
    }
    return json({ inserted: rows.length, rejected });
  } catch (err) {
    console.error('[progress] supabase unreachable', err);
    return json({ error: 'insert failed' }, 502);
  } finally {
    clearTimeout(timer);
  }
}

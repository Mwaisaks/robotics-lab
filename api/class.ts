/// <reference types="node" />
/**
 * GET /api/class?code=XXXX  (Vercel function) -> { rows: ClassRow[] }
 * Validates the class code (A-Z/0-9, 4-8 chars, upper-cased) and reads that one class
 * through the Supabase RPC class_events (docs/data.md). Keys stay in server env.
 * Per-IP rate limit, so class codes can't be guessed quickly.
 */
import { createRateLimiter } from '../src/tutor/ai-hint.js';
import { normalizeClassCode } from '../src/tutor/progress-rows.js';

const SUPABASE_TIMEOUT_MS = 8000;
const FIELDS = ['nickname', 'activity', 'type', 'challenge', 'code', 'stars', 'seconds', 'mistakes', 'created_at'] as const;

// 30 lookups per minute per IP: plenty for a teacher refreshing, slow for guessing codes.
const allow = createRateLimiter(Number(process.env.CLASS_RATE_LIMIT) || 30, 60_000);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

export async function GET(request: Request): Promise<Response> {
  const code = normalizeClassCode(new URL(request.url).searchParams.get('code'));
  if (!code) return json({ error: 'class code must be 4-8 letters or digits' }, 400);
  if (!allow(clientIp(request))) return json({ error: 'too many requests, wait a minute' }, 429);

  const base = process.env.SUPABASE_URL?.replace(/\/+$/, '');
  const key = process.env.SUPABASE_ANON_KEY;
  if (!base || !key) return json({ error: 'dashboard not configured' }, 503);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/rest/v1/rpc/class_events`, {
      method: 'POST',
      headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_class_code: code }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error('[class] supabase rpc failed', res.status, (await res.text()).slice(0, 300));
      return json({ error: 'could not load class' }, 502);
    }
    const data: unknown = await res.json();
    const rows = (Array.isArray(data) ? data : []).map((r: Record<string, unknown>) =>
      Object.fromEntries(FIELDS.map((f) => [f, r[f] ?? null])),
    );
    return json({ code, rows });
  } catch (err) {
    console.error('[class] supabase unreachable', err);
    return json({ error: 'could not load class' }, 502);
  } finally {
    clearTimeout(timer);
  }
}

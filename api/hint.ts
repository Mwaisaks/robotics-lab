/**
 * POST /api/hint  (Vercel function)
 * Body: HintRequest { activity, code, attempt, lang, context? }  ->  HintResponse { text, source }
 *
 * - The LLM key stays here (env LLM_API_KEY), never in the browser.
 * - 3 s timeout; on timeout, error, refusal or a bad answer -> built-in hint (still 200).
 * - Simple per-IP rate limit; over the limit -> built-in hint, no LLM call.
 * - Only activity/code/attempt/lang/context reach the LLM; nicknames and class codes are dropped.
 */
import Anthropic from '@anthropic-ai/sdk';
import { createRateLimiter, getHint, HINT_TIMEOUT_MS, parseHintRequest, type LlmCall } from '../src/tutor/ai-hint.js';
import { builtinHintResponse } from '../src/tutor/hints.js';

// Claude Opus 5.5 by default; set HINT_MODEL in Vercel to switch model without a code change.
const MODEL = process.env.HINT_MODEL || 'claude-opus-5-5';

// Default 30 hints per minute per IP (env HINT_RATE_LIMIT). A class behind one school IP shares it, so keep it generous.
const allow = createRateLimiter(Number(process.env.HINT_RATE_LIMIT) || 30, 60_000);

const apiKey = process.env.LLM_API_KEY;
const client = apiKey ? new Anthropic({ apiKey, maxRetries: 0, timeout: HINT_TIMEOUT_MS }) : undefined;

const callClaude: LlmCall | undefined = client
  ? async (system, user, signal) => {
      const res = await client.beta.messages.create(
        {
          model: MODEL,
          max_tokens: 1024,
          output_config: { effort: 'low' }, // short hints; keeps latency well inside 3 s
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          system,
          messages: [{ role: 'user', content: user }],
        },
        { signal },
      );
      if (res.stop_reason !== 'end_turn') return ''; // refusal / max_tokens -> built-in hint
      return res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    }
  : undefined;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }
  const req = parseHintRequest(body);
  if (!req) return json({ error: 'invalid hint request' }, 400);

  if (!allow(clientIp(request))) return json(builtinHintResponse(req));

  return json(await getHint(req, callClaude));
}

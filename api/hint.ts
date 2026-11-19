/// <reference types="node" />
/**
 * POST /api/hint  (Vercel function)
 * Body: HintRequest { activity, code, attempt, lang, context? }  ->  HintResponse { text, source }
 *
 * - Calls Google Gemini over REST with plain fetch. Key stays here (env LLM_API_KEY), never in the browser.
 * - 3 s timeout; on timeout, error, blocked or off-topic/too-long answer -> built-in hint (still 200).
 * - Simple per-IP rate limit; over the limit -> built-in hint, no LLM call.
 * - Only activity/code/attempt/lang/context reach the LLM; nicknames and class codes are dropped.
 * API reference: https://aistudio.google.com/api-reference/generate-content
 */
import { createRateLimiter, getHint, parseHintRequest, type LlmCall } from '../src/tutor/ai-hint.js';
import { builtinHintResponse } from '../src/tutor/hints.js';

// Gemini Flash by default; set HINT_MODEL in Vercel to switch model without a code change.
const MODEL = process.env.HINT_MODEL || 'gemini-3.8-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;

// Default 30 hints per minute per IP (env HINT_RATE_LIMIT). A class behind one school IP shares it, so keep it generous.
const allow = createRateLimiter(Number(process.env.HINT_RATE_LIMIT) || 30, 60_000);

const apiKey = process.env.LLM_API_KEY;

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

const callGemini: LlmCall | undefined = apiKey
  ? async (system, user, signal) => {
      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: {
            maxOutputTokens: 200,
            // thinkingLevel is Gemini 3+ only (errors on older models); minimal thinking keeps us inside 3 s.
            ...(MODEL.startsWith('gemini-3') ? { thinkingConfig: { thinkingLevel: 'MINIMAL' } } : {}),
          },
        }),
        signal,
      });
      if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
      const data = (await res.json()) as GeminiResponse;
      const candidate = data.candidates?.[0];
      // Blocked prompt, safety stop, cut-off answer, etc. -> '' -> built-in hint.
      if (data.promptFeedback?.blockReason || candidate?.finishReason !== 'STOP') return '';
      return (candidate.content?.parts ?? []).map((p) => p.text ?? '').join('');
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

  return json(await getHint(req, callGemini));
}

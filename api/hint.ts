/// <reference types="node" />
/**
 * POST /api/hint  (Vercel function)
 * Body: HintRequest { activity, code, attempt, lang, context? }  ->  HintResponse { text, source }
 *
 * - Calls Google Gemini over REST with plain fetch. Key stays here (env LLM_API_KEY), never in the browser.
 * - Tries the models in HINT_MODELS in order: 429/503 (busy) or 404 -> next model at once;
 *   400 about thinking -> same model once more without thinkingConfig.
 * - All models and retries share ONE 5.5 s budget (SERVER_HINT_BUDGET_MS); then (or on any other failure) -> built-in hint (still 200).
 * - Good AI answers are cached by the full request (activity, code, lang, attempt, context), so repeats are instant.
 * - Simple per-IP rate limit; over the limit -> cached or built-in hint, no LLM call.
 * - Only activity/code/attempt/lang/context reach the LLM; nicknames and class codes are dropped.
 * API reference: https://aistudio.google.com/api-reference/generate-content
 */
import { createHintCache, createRateLimiter, getHint, parseHintRequest, SERVER_HINT_BUDGET_MS, type LlmCall } from '../src/tutor/ai-hint.js';

// gemini-2.5 models are not available on our key. Override with HINT_MODELS="a,b,c" in Vercel.
const DEFAULT_MODELS = 'gemini-3.5-flash-lite,gemini-3.8-flash,gemini-3.7-flash';
const MODELS = (process.env.HINT_MODELS || DEFAULT_MODELS)
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

const THINKING_CONFIG = { thinkingLevel: 'LOW' }; // MINIMAL is rejected by gemini-3.8-flash

// Default 30 hints per minute per IP (env HINT_RATE_LIMIT). A class behind one school IP shares it, so keep it generous.
const allow = createRateLimiter(Number(process.env.HINT_RATE_LIMIT) || 30, 60_000);
const cache = createHintCache();

const apiKey = process.env.LLM_API_KEY;

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

function geminiUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
}

const callGemini: LlmCall | undefined = apiKey
  ? async (system, user, signal) => {
      for (const model of MODELS) {
        let withThinking = true;
        for (;;) {
          const res = await fetch(geminiUrl(model), {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: system }] },
              contents: [{ role: 'user', parts: [{ text: user }] }],
              generationConfig: {
                maxOutputTokens: 1024, // room for LOW thinking; the hint itself is checked for length
                ...(withThinking ? { thinkingConfig: THINKING_CONFIG } : {}),
              },
            }),
            signal, // the shared 5.5 s budget: aborts whichever model is running
          });
          if (res.ok) {
            const data = (await res.json()) as GeminiResponse;
            const candidate = data.candidates?.[0];
            // Blocked prompt, safety stop, cut-off answer, etc. -> '' -> built-in hint.
            if (data.promptFeedback?.blockReason || candidate?.finishReason !== 'STOP') return '';
            return (candidate.content?.parts ?? []).map((p) => p.text ?? '').join('');
          }
          if (res.status === 400 && withThinking && /thinking/i.test(await res.text())) {
            withThinking = false; // retry this model once without thinkingConfig
            continue;
          }
          if (res.status === 429 || res.status === 503 || res.status === 404) break; // busy or unknown model -> next
          throw new Error(`Gemini ${model} HTTP ${res.status}`);
        }
      }
      throw new Error('All Gemini models busy or unavailable');
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

  // Over the limit: no LLM call, but a cached AI answer is still fine to return.
  const llm = allow(clientIp(request)) ? callGemini : undefined;
  return json(await getHint(req, llm, { cache, timeoutMs: SERVER_HINT_BUDGET_MS }));
}

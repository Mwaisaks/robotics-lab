/**
 * Browser-side call to /api/hint. Returns the AI hint text, or null if there is
 * no AI answer within the time limit (offline, slow, error, or the server fell
 * back to a built-in hint). Never throws. No DOM; uses fetch only.
 */
import { HINT_TIMEOUT_MS } from './ai-hint.js';
import type { HintRequest } from './hints.js';

export interface FetchAiHintOptions {
  url?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export async function fetchAiHint(
  req: HintRequest,
  { url = '/api/hint', timeoutMs = HINT_TIMEOUT_MS, fetchFn = globalThis.fetch }: FetchAiHintOptions = {},
): Promise<string | null> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
  if (typeof fetchFn !== 'function') return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // Only the HintRequest fields: never a nickname or class code.
      body: JSON.stringify({
        activity: req.activity,
        code: req.code,
        attempt: req.attempt,
        lang: req.lang,
        ...(req.context ? { context: req.context } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { text?: unknown; source?: unknown };
    return data.source === 'ai' && typeof data.text === 'string' && data.text.trim() !== '' ? data.text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

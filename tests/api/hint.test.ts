import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../../api/hint.js';
import { builtinHint } from '../../src/tutor/hints.js';

// LLM_API_KEY is not set in tests, so the endpoint must answer from built-in hints.
function post(body: unknown, ip = '10.0.0.1'): Request {
  return new Request('http://localhost/api/hint', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/hint', () => {
  it('returns the built-in hint when no LLM key is configured', async () => {
    const res = await POST(post({ activity: 'circuit', code: 'LED_REVERSED', attempt: 1, lang: 'sw', nickname: 'Juma' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: builtinHint('circuit', 'LED_REVERSED', 'sw'), source: 'builtin' });
  });

  it('rejects invalid JSON and invalid requests with 400', async () => {
    expect((await POST(post('{not json'))).status).toBe(400);
    expect((await POST(post({ activity: 'chess', code: 'X' }))).status).toBe(400);
  });

  it('keeps answering with built-in hints when rate limited', async () => {
    for (let i = 0; i < 40; i++) {
      const res = await POST(post({ activity: 'sort', code: 'WRONG_BIN' }, '10.9.9.9'));
      expect(res.status).toBe(200);
      expect((await res.json()).source).toBe('builtin');
    }
  });
});

describe('POST /api/hint with Gemini (fetch mocked)', () => {
  type Call = { model: string; body: { generationConfig: { thinkingConfig?: { thinkingLevel: string } } } };
  const calls: Call[] = [];
  let signals: (AbortSignal | undefined)[] = [];

  /** Reload the endpoint with a key (fresh cache + rate limit) and a scripted fetch. */
  async function load(reply: (model: string, callNo: number) => Response | Promise<Response>, models?: string) {
    calls.length = 0;
    signals = [];
    vi.resetModules();
    vi.stubEnv('LLM_API_KEY', 'test-key');
    vi.stubEnv('HINT_MODELS', models ?? '');
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      const model = /models\/([^:]+):generateContent$/.exec(url)![1]!;
      calls.push({ model, body: JSON.parse(String(init.body)) });
      signals.push(init.signal ?? undefined);
      return reply(decodeURIComponent(model), calls.length);
    });
    vi.stubGlobal('fetch', fetchMock);
    return { POST: (await import('../../api/hint.js')).POST, fetchMock };
  }
  const ok = (text: string, finishReason = 'STOP') =>
    new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason }] }), { status: 200 });
  const status = (code: number, message = 'error') =>
    new Response(JSON.stringify({ error: { code, message } }), { status: code });
  const hit = (lang = 'en', attempt = 1) => post({ activity: 'program', code: 'HIT_WALL', lang, attempt });
  const builtin = (lang: 'en' | 'sw' = 'en') => ({ text: builtinHint('program', 'HIT_WALL', lang), source: 'builtin' });
  const never = () => new Promise<Response>(() => {});

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('uses gemini-3.8-flash first, with thinkingLevel LOW and the key header', async () => {
    const { POST, fetchMock } = await load(() => ok('Count the squares. Then move forward.'));
    expect(await (await POST(hit())).json()).toEqual({ text: 'Count the squares. Then move forward.', source: 'ai' });
    expect(calls.map((c) => c.model)).toEqual(['gemini-3.8-flash']);
    expect(calls[0]!.body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'LOW' });
    expect((fetchMock.mock.calls[0]![1].headers as Record<string, string>)['x-goog-api-key']).toBe('test-key');
  });

  it('sends no nickname or class code', async () => {
    const { POST, fetchMock } = await load(() => ok('Count the squares.'));
    await POST(post({ activity: 'program', code: 'HIT_WALL', nickname: 'Zawadi', classCode: 'ABC123', context: 'Zawadi FORWARD x5' }));
    expect(String(fetchMock.mock.calls[0]![1].body)).not.toMatch(/Zawadi|ABC123/);
  });

  it('503 (high demand) -> tries the next model', async () => {
    const { POST } = await load((model) => (model === 'gemini-3.8-flash' ? status(503, 'high demand') : ok('Try turning first.')));
    expect(await (await POST(hit())).json()).toEqual({ text: 'Try turning first.', source: 'ai' });
    expect(calls.map((c) => c.model)).toEqual(['gemini-3.8-flash', 'gemini-3.7-flash']);
  });

  it('429 -> tries the next model, down to the last one', async () => {
    const { POST } = await load((model) => (model === 'gemini-3.5-flash-lite' ? ok('Count again.') : status(429)));
    expect(await (await POST(hit())).json()).toEqual({ text: 'Count again.', source: 'ai' });
    expect(calls.map((c) => c.model)).toEqual(['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite']);
  });

  it('400 about thinking -> retries the same model once without thinkingConfig', async () => {
    const { POST } = await load((_m, n) =>
      n === 1 ? status(400, 'thinking_level is not supported for this model') : ok('Count the squares.'),
    );
    expect(await (await POST(hit())).json()).toEqual({ text: 'Count the squares.', source: 'ai' });
    expect(calls.map((c) => c.model)).toEqual(['gemini-3.8-flash', 'gemini-3.8-flash']);
    expect(calls[0]!.body.generationConfig.thinkingConfig).toBeDefined();
    expect(calls[1]!.body.generationConfig.thinkingConfig).toBeUndefined();
  });

  it('retries without thinking only once, then gives up', async () => {
    const { POST } = await load(() => status(400, 'thinking is not supported'));
    expect(await (await POST(hit())).json()).toEqual(builtin());
    expect(calls).toHaveLength(2);
  });

  it('a 400 not about thinking -> built-in hint, no retry', async () => {
    const { POST } = await load(() => status(400, 'invalid argument'));
    expect(await (await POST(hit())).json()).toEqual(builtin());
    expect(calls).toHaveLength(1);
  });

  it('all models fail -> built-in hint', async () => {
    const { POST } = await load(() => status(503, 'high demand'));
    expect(await (await POST(hit('sw'))).json()).toEqual(builtin('sw'));
    expect(calls.map((c) => c.model)).toEqual(['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite']);
  });

  it('safety stop or off-topic answer -> built-in hint', async () => {
    for (const reply of [() => ok('x', 'SAFETY'), () => ok('OFF_TOPIC')]) {
      const { POST } = await load(reply);
      expect(await (await POST(hit())).json()).toEqual(builtin());
    }
  });

  it('timeout -> built-in hint after 3 s, and the running call is aborted', async () => {
    vi.useFakeTimers();
    const { POST } = await load(never);
    const pending = POST(hit());
    await vi.advanceTimersByTimeAsync(2999);
    expect(signals[0]?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await (await pending).json()).toEqual(builtin());
    expect(signals[0]?.aborted).toBe(true);
  });

  it('all models and retries share one 3 s budget', async () => {
    vi.useFakeTimers();
    // Each model answers after 1.2 s; the third would answer at 3.6 s, past the budget.
    const { POST } = await load(
      (model) =>
        new Promise<Response>((resolve) =>
          setTimeout(() => resolve(model === 'gemini-3.5-flash-lite' ? ok('Too late.') : status(503)), 1200),
        ),
    );
    const pending = POST(hit());
    await vi.advanceTimersByTimeAsync(3000);
    expect(await (await pending).json()).toEqual(builtin());
    expect(calls).toHaveLength(3); // the third model was started, then cut off
    expect(signals[2]?.aborted).toBe(true);
  });

  it('caches good answers by activity+code+lang+attempt', async () => {
    const { POST } = await load(() => ok('Count the squares.'));
    await POST(hit('en', 1));
    expect(await (await POST(hit('en', 1))).json()).toEqual({ text: 'Count the squares.', source: 'ai' });
    expect(calls).toHaveLength(1); // second request served from the cache
    await POST(hit('sw', 1));
    await POST(hit('en', 2));
    expect(calls).toHaveLength(3); // other lang / attempt -> new calls
  });

  it('does not cache built-in fallbacks', async () => {
    const { POST } = await load((_m, n) => (n <= 3 ? status(503) : ok('Now it works.')));
    expect(await (await POST(hit())).json()).toEqual(builtin());
    expect(await (await POST(hit())).json()).toEqual({ text: 'Now it works.', source: 'ai' });
  });

  it('respects HINT_MODELS', async () => {
    const { POST } = await load(() => status(503), ' gemini-a , gemini-b ');
    await POST(hit());
    expect(calls.map((c) => c.model)).toEqual(['gemini-a', 'gemini-b']);
  });
});

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
  async function loadWithKey() {
    vi.resetModules();
    vi.stubEnv('LLM_API_KEY', 'test-key');
    vi.stubEnv('HINT_MODEL', '');
    return (await import('../../api/hint.js')).POST;
  }
  function gemini(text: string, finishReason = 'STOP') {
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason }] }), { status: 200 });
  }
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('sends no nickname or class code and returns the AI hint', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => gemini('Count the squares. Then move forward.'));
    vi.stubGlobal('fetch', fetchMock);
    const POST = await loadWithKey();
    const res = await POST(
      post({ activity: 'program', code: 'HIT_WALL', lang: 'en', nickname: 'Zawadi', classCode: 'ABC123', context: 'Zawadi FORWARD x5' }),
    );
    expect(await res.json()).toEqual({ text: 'Count the squares. Then move forward.', source: 'ai' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toMatch(/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-[\w.-]*flash[\w.-]*:generateContent$/);
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key');
    expect(String(init.body)).not.toMatch(/Zawadi|ABC123/);
  });

  it('falls back to the built-in hint on a safety stop, HTTP error or off-topic answer', async () => {
    for (const reply of [gemini('x', 'SAFETY'), new Response('nope', { status: 500 }), gemini('OFF_TOPIC')]) {
      vi.stubGlobal('fetch', vi.fn(async () => reply));
      const POST = await loadWithKey();
      const res = await POST(post({ activity: 'program', code: 'HIT_WALL', lang: 'sw' }));
      expect(await res.json()).toEqual({ text: builtinHint('program', 'HIT_WALL', 'sw'), source: 'builtin' });
    }
  });

  it('falls back after 3 s when Gemini is slow', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));
    const POST = await loadWithKey();
    const pending = POST(post({ activity: 'circuit', code: 'OPEN_LOOP', lang: 'en' }));
    await vi.advanceTimersByTimeAsync(3000);
    expect(await (await pending).json()).toEqual({ text: builtinHint('circuit', 'OPEN_LOOP', 'en'), source: 'builtin' });
  });
});

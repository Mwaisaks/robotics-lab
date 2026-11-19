import { describe, expect, it } from 'vitest';
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

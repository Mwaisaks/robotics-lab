import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../../api/progress.js';

const row = (over: Record<string, unknown> = {}) => ({
  class_code: 'demo26',
  nickname: 'Zawadi',
  activity: 'program',
  type: 'mistake',
  code: 'HIT_WALL',
  client_t: 1000,
  ...over,
});
const post = (body: unknown) =>
  new Request('http://localhost/api/progress', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('POST /api/progress', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co/');
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key');
    fetchMock = vi.fn(async () => new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('inserts valid rows into Supabase with the anon key and return=minimal', async () => {
    const res = await POST(post({ rows: [row(), row({ type: 'activity_completed', code: undefined, challenge: 1, stars: 2, seconds: 30, mistakes: 1 })] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ inserted: 2, rejected: 0 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.supabase.co/rest/v1/events');
    const headers = init.headers as Record<string, string>;
    expect(headers.apikey).toBe('anon-key');
    expect(headers.authorization).toBe('Bearer anon-key');
    expect(headers.prefer).toBe('return=minimal');
    const sent = JSON.parse(String(init.body));
    expect(sent[0].class_code).toBe('DEMO26');
    expect(sent[1]).toMatchObject({ type: 'activity_completed', stars: 2, code: null });
  });

  it('drops invalid rows and extra fields, and counts them', async () => {
    const res = await POST(
      post([row({ email: 'x@y.z' }), row({ class_code: 'ab' }), row({ nickname: 'x'.repeat(21) }), row({ activity: 'chess' }), row({ type: 'action' })]),
    );
    expect(await res.json()).toEqual({ inserted: 1, rejected: 4 });
    const sent = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(sent).toHaveLength(1);
    expect(sent[0]).not.toHaveProperty('email');
  });

  it('does not call Supabase when every row is invalid', async () => {
    expect(await (await POST(post([row({ activity: 'chess' })]))).json()).toEqual({ inserted: 0, rejected: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects bad bodies with 400', async () => {
    expect((await POST(post('{nope'))).status).toBe(400);
    expect((await POST(post({ rows: [] }))).status).toBe(400);
    expect((await POST(post({ rows: Array.from({ length: 51 }, () => row()) }))).status).toBe(400);
  });

  it('returns 502 when Supabase fails, so the client keeps its rows', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockImplementationOnce(async () => new Response('violates check constraint', { status: 400 }));
    expect((await POST(post([row()]))).status).toBe(502);
    fetchMock.mockImplementationOnce(async () => {
      throw new TypeError('fetch failed');
    });
    expect((await POST(post([row()]))).status).toBe(502);
    err.mockRestore();
  });

  it('returns 503 when Supabase is not configured', async () => {
    vi.stubEnv('SUPABASE_URL', '');
    expect((await POST(post([row()]))).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

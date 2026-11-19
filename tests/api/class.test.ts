import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const get = (qs: string, ip = '10.0.0.1') => new Request(`http://localhost/api/class${qs}`, { headers: { 'x-forwarded-for': ip } });

describe('GET /api/class', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let GET: (r: Request) => Promise<Response>;
  beforeEach(async () => {
    vi.resetModules(); // fresh rate limiter per test
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co/');
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key');
    fetchMock = vi.fn(async () =>
      new Response(JSON.stringify([{ id: 1, class_code: 'DEMO1', nickname: 'Zawadi', activity: 'sort', type: 'mistake', code: 'WRONG_BIN', created_at: '2026-11-19T15:00:00Z', client_t: 5 }]), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    GET = (await import('../../api/class.js')).GET;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('calls the class_events RPC with the upper-cased code and server keys', async () => {
    const res = await GET(get('?code=demo1'));
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.supabase.co/rest/v1/rpc/class_events');
    expect(JSON.parse(String(init.body))).toEqual({ p_class_code: 'DEMO1' });
    expect((init.headers as Record<string, string>).apikey).toBe('anon-key');
    const data = await res.json();
    expect(data.code).toBe('DEMO1');
    expect(data.rows[0]).toEqual({
      nickname: 'Zawadi', activity: 'sort', type: 'mistake', challenge: null, code: 'WRONG_BIN', stars: null, seconds: null, mistakes: null, created_at: '2026-11-19T15:00:00Z',
    });
    expect(JSON.stringify(data)).not.toContain('anon-key');
  });

  it('rejects missing or invalid codes without calling Supabase', async () => {
    for (const qs of ['', '?code=', '?code=ab', '?code=TOOLONGCODE', '?code=AB-12']) {
      expect((await GET(get(qs))).status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rate limits guessing', async () => {
    for (let i = 0; i < 30; i++) expect((await GET(get('?code=DEMO1', '10.1.1.1'))).status).toBe(200);
    expect((await GET(get('?code=DEMO1', '10.1.1.1'))).status).toBe(429);
  });

  it('502 when Supabase fails, 503 when not configured', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockImplementationOnce(async () => new Response('boom', { status: 500 }));
    expect((await GET(get('?code=DEMO1'))).status).toBe(502);
    vi.stubEnv('SUPABASE_ANON_KEY', '');
    expect((await GET(get('?code=DEMO1'))).status).toBe(503);
    err.mockRestore();
  });
});

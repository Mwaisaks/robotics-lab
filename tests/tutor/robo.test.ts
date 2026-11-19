import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEventBus, type LearningEvent } from '../../src/core/events.js';
import { fetchAiHint } from '../../src/tutor/ai-client.js';
import { builtinHint, type HintRequest } from '../../src/tutor/hints.js';
import { startTutor, type HintSource } from '../../src/tutor/robo.js';

function setup(fetchHint: (req: HintRequest) => Promise<string | null> = async () => null, lang: 'en' | 'sw' | (() => 'en' | 'sw') = 'en') {
  const bus = createEventBus();
  const seen: LearningEvent[] = [];
  bus.on((e) => seen.push(e));
  const shown: [string, HintSource][] = [];
  const fetchMock = vi.fn(fetchHint);
  const tutor = startTutor({ lang, bus, show: (text, source) => shown.push([text, source]), fetchHint: fetchMock });
  const mistake = (code = 'HIT_WALL', activity: 'program' | 'circuit' = 'program', detail?: string) =>
    bus.emit({ type: 'mistake', activity, code, t: 1, ...(detail ? { detail } : {}) });
  const hintEvents = () => seen.filter((e) => e.type === 'hint_shown');
  return { bus, tutor, shown, fetchMock, mistake, hintEvents };
}

/** Let pending promise callbacks run. */
const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('startTutor', () => {
  it('shows the built-in hint immediately and emits hint_shown builtin', () => {
    const { shown, mistake, hintEvents } = setup(() => new Promise(() => {}));
    mistake();
    // synchronous: no await needed, so it works offline and well within 1 s
    expect(shown).toEqual([[builtinHint('program', 'HIT_WALL', 'en'), 'builtin']]);
    expect(hintEvents()).toMatchObject([{ type: 'hint_shown', activity: 'program', code: 'HIT_WALL', source: 'builtin' }]);
  });

  it('replaces the text when an AI answer arrives, and emits hint_shown ai', async () => {
    const { shown, mistake, hintEvents } = setup(async () => 'Count the squares first.');
    mistake();
    await flush();
    expect(shown.map((s) => s[1])).toEqual(['builtin', 'ai']);
    expect(shown[1]![0]).toBe('Count the squares first.');
    expect(hintEvents().map((e) => e.type === 'hint_shown' && e.source)).toEqual(['builtin', 'ai']);
  });

  it('keeps the built-in hint when there is no AI answer or the call fails', async () => {
    for (const f of [async () => null, async () => Promise.reject(new Error('offline'))]) {
      const { shown, mistake, hintEvents } = setup(f);
      mistake();
      await flush();
      expect(shown).toHaveLength(1);
      expect(hintEvents()).toHaveLength(1);
    }
  });

  it('ignores an AI answer that arrives after 3 s', async () => {
    vi.useFakeTimers();
    const { shown, mistake } = setup(() => new Promise((r) => setTimeout(() => r('Too late.'), 3500)));
    mistake();
    await vi.advanceTimersByTimeAsync(3500);
    expect(shown.map((s) => s[1])).toEqual(['builtin']);
  });

  it('uses an AI answer that arrives just inside 3 s', async () => {
    vi.useFakeTimers();
    const { shown, mistake } = setup(() => new Promise((r) => setTimeout(() => r('Just in time.'), 2900)));
    mistake();
    await vi.advanceTimersByTimeAsync(2900);
    expect(shown[shown.length - 1]).toEqual(['Just in time.', 'ai']);
  });

  it('drops a stale AI answer once a newer mistake has happened', async () => {
    let resolveFirst!: (t: string) => void;
    const calls: HintRequest[] = [];
    const { shown, mistake } = setup((req) => {
      calls.push(req);
      return calls.length === 1 ? new Promise((r) => (resolveFirst = r)) : new Promise(() => {});
    });
    mistake('HIT_WALL');
    mistake('MISSED_GOAL');
    resolveFirst('Old answer.');
    await flush();
    expect(shown.map((s) => s[0])).not.toContain('Old answer.');
    expect(shown[shown.length - 1]).toEqual([builtinHint('program', 'MISSED_GOAL', 'en'), 'builtin']);
  });

  it('counts attempts per activity+code and resets when the activity starts again', () => {
    const { bus, tutor, fetchMock, mistake } = setup();
    mistake('HIT_WALL');
    mistake('HIT_WALL');
    mistake('MISSED_GOAL');
    mistake('OPEN_LOOP', 'circuit');
    expect(fetchMock.mock.calls.map((c) => [c[0].code, c[0].attempt])).toEqual([
      ['HIT_WALL', 1],
      ['HIT_WALL', 2],
      ['MISSED_GOAL', 1],
      ['OPEN_LOOP', 1],
    ]);
    expect(tutor.attempts('program', 'HIT_WALL')).toBe(2);

    bus.emit({ type: 'activity_started', activity: 'program', challenge: 1, mode: 'web', t: 2 });
    expect(tutor.attempts('program', 'HIT_WALL')).toBe(0);
    expect(tutor.attempts('circuit', 'OPEN_LOOP')).toBe(1);
    mistake('HIT_WALL');
    expect(fetchMock.mock.calls[fetchMock.mock.calls.length - 1]![0].attempt).toBe(1);
  });

  it('uses the current language from a getter, and sends it to the AI', () => {
    let lang: 'en' | 'sw' = 'en';
    const { shown, fetchMock, mistake } = setup(async () => null, () => lang);
    mistake();
    lang = 'sw';
    mistake();
    expect(shown[1]).toEqual([builtinHint('program', 'HIT_WALL', 'sw'), 'builtin']);
    expect(fetchMock.mock.calls[1]![0].lang).toBe('sw');
  });

  it('passes the mistake detail as context', () => {
    const { fetchMock, mistake } = setup();
    mistake('HIT_WALL', 'program', 'FORWARD x5');
    expect(fetchMock.mock.calls[0]![0]).toEqual({ activity: 'program', code: 'HIT_WALL', attempt: 1, lang: 'en', context: 'FORWARD x5' });
  });

  it('gives a generic hint for an unknown code', () => {
    const { shown, mistake } = setup();
    mistake('BRAND_NEW_CODE');
    expect(shown[0]).toEqual([builtinHint('program', 'BRAND_NEW_CODE', 'en'), 'builtin']);
  });

  it('ignores other events and its own hint_shown events', () => {
    const { bus, shown, fetchMock } = setup();
    bus.emit({ type: 'action', activity: 'program', name: 'run', t: 1 });
    bus.emit({ type: 'hint_shown', activity: 'program', code: 'HIT_WALL', source: 'ai', t: 1 });
    expect(shown).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stop() unsubscribes and ignores pending AI answers', async () => {
    let resolve!: (t: string) => void;
    const { tutor, shown, mistake } = setup(() => new Promise((r) => (resolve = r)));
    mistake();
    tutor.stop();
    resolve('Late answer.');
    await flush();
    mistake();
    expect(shown).toHaveLength(1);
  });

  it('a show() that throws does not break the bus or emit hint_shown', () => {
    const bus = createEventBus();
    const seen: LearningEvent[] = [];
    bus.on((e) => seen.push(e));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    startTutor({ lang: 'en', bus, fetchHint: async () => null, show: () => { throw new Error('no panel'); } });
    expect(() => bus.emit({ type: 'mistake', activity: 'program', code: 'HIT_WALL', t: 1 })).not.toThrow();
    expect(seen.filter((e) => e.type === 'hint_shown')).toHaveLength(0);
    err.mockRestore();
  });

  it('by default calls /api/hint with only the HintRequest fields', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ text: 'AI hint.', source: 'ai' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const bus = createEventBus();
    const shown: string[] = [];
    startTutor({ lang: 'sw', bus, show: (t) => shown.push(t) });
    bus.emit({ type: 'mistake', activity: 'circuit', code: 'NO_RESISTOR', t: 1 });
    await flush();
    expect(shown).toEqual([builtinHint('circuit', 'NO_RESISTOR', 'sw'), 'AI hint.']);
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/hint');
    expect(JSON.parse(String(init.body))).toEqual({ activity: 'circuit', code: 'NO_RESISTOR', attempt: 1, lang: 'sw' });
  });
});

describe('fetchAiHint', () => {
  const req: HintRequest = { activity: 'program', code: 'HIT_WALL', attempt: 1, lang: 'en' };
  const res = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status });

  it('returns the text only for an AI answer', async () => {
    expect(await fetchAiHint(req, { fetchFn: res({ text: 'Hi.', source: 'ai' }) })).toBe('Hi.');
    expect(await fetchAiHint(req, { fetchFn: res({ text: 'Built-in.', source: 'builtin' }) })).toBeNull();
    expect(await fetchAiHint(req, { fetchFn: res({ text: '', source: 'ai' }) })).toBeNull();
  });

  it('returns null on HTTP errors, bad JSON and network errors', async () => {
    expect(await fetchAiHint(req, { fetchFn: res({ error: 'x' }, 500) })).toBeNull();
    expect(await fetchAiHint(req, { fetchFn: async () => new Response('not json') })).toBeNull();
    expect(await fetchAiHint(req, { fetchFn: async () => { throw new TypeError('Failed to fetch'); } })).toBeNull();
  });

  it('gives up after 3 s and aborts the request', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const fetchFn = (_u: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_r, reject) => {
        signal = init?.signal ?? undefined;
        signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    const pending = fetchAiHint(req, { fetchFn: fetchFn as typeof fetch });
    await vi.advanceTimersByTimeAsync(3000);
    expect(await pending).toBeNull();
    expect(signal?.aborted).toBe(true);
  });

  it('does not call the network when the browser is offline', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const fetchFn = vi.fn();
    expect(await fetchAiHint(req, { fetchFn: fetchFn as unknown as typeof fetch })).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

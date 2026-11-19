import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEventBus, type EventBus } from '../../src/core/events.js';
import { eventToRow, normalizeClassCode, normalizeNickname, validateRow } from '../../src/tutor/progress-rows.js';
import { getPlayer, MAX_QUEUE, QUEUE_KEY, setPlayer, startSync, type KeyValueStore, type Sync } from '../../src/tutor/sync.js';

class FakeStorage implements KeyValueStore {
  data = new Map<string, string>();
  failWrites = false;
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.data.set(k, v);
  }
  rows() {
    return (JSON.parse(this.data.get(QUEUE_KEY) ?? '[]') as { row: unknown }[]).map((q) => q.row);
  }
}

function setup({ online = true, status = 200, batchSize = 25 } = {}) {
  const bus = createEventBus();
  const storage = new FakeStorage();
  const onlineTarget = new EventTarget();
  const net = { online, status };
  const bodies: { rows: Record<string, unknown>[] }[] = [];
  const fetchFn = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init!.body)));
    return new Response('{}', { status: net.status });
  });
  const sync = startSync({ bus, storage, fetchFn: fetchFn as unknown as typeof fetch, isOnline: () => net.online, onlineTarget, batchSize });
  syncs.push(sync);
  return { bus, storage, onlineTarget, net, fetchFn, bodies, sync };
}

const syncs: Sync[] = [];
const mistake = (bus: EventBus, code = 'HIT_WALL', t = 1000) => bus.emit({ type: 'mistake', activity: 'program', code, t });
const completed = (bus: EventBus) =>
  bus.emit({ type: 'activity_completed', activity: 'circuit', challenge: 0, stars: 3, seconds: 42.4, mistakes: 1, t: 2000 });
const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  syncs.splice(0).forEach((s) => s.stop());
  setPlayer(null);
  vi.useRealTimers();
});

describe('setPlayer', () => {
  it('accepts a valid player and upper-cases the class code', () => {
    expect(setPlayer({ classCode: ' demo26 ', nickname: ' Zawadi ' })).toBe(true);
    expect(getPlayer()).toEqual({ classCode: 'DEMO26', nickname: 'Zawadi' });
  });

  it('rejects invalid class codes and nicknames', () => {
    expect(setPlayer({ classCode: 'AB', nickname: 'Zawadi' })).toBe(false);
    expect(setPlayer({ classCode: 'DEMO-26', nickname: 'Zawadi' })).toBe(false);
    expect(setPlayer({ classCode: 'DEMO26', nickname: '' })).toBe(false);
    expect(setPlayer({ classCode: 'DEMO26', nickname: 'x'.repeat(21) })).toBe(false);
    expect(getPlayer()).toBeNull();
  });
});

describe('startSync', () => {
  it('no player -> nothing queued or sent', async () => {
    const { bus, storage, fetchFn, sync } = setup();
    mistake(bus);
    completed(bus);
    await flush();
    expect(sync.queued()).toBe(0);
    expect(storage.rows()).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('online -> sends the rows right away and empties the queue', async () => {
    setPlayer({ classCode: 'demo26', nickname: 'Zawadi' });
    const { bus, bodies, sync } = setup();
    mistake(bus);
    await sync.flush();
    completed(bus);
    await sync.flush();
    expect(sync.queued()).toBe(0);
    expect(bodies.flatMap((b) => b.rows)).toEqual([
      { class_code: 'DEMO26', nickname: 'Zawadi', activity: 'program', type: 'mistake', challenge: null, code: 'HIT_WALL', stars: null, seconds: null, mistakes: null, client_t: 1000 },
      { class_code: 'DEMO26', nickname: 'Zawadi', activity: 'circuit', type: 'activity_completed', challenge: 0, code: null, stars: 3, seconds: 42, mistakes: 1, client_t: 2000 },
    ]);
  });

  it('only syncs mistake and activity_completed events', async () => {
    setPlayer({ classCode: 'DEMO26', nickname: 'Juma' });
    const { bus, sync } = setup({ online: false });
    bus.emit({ type: 'activity_started', activity: 'sort', challenge: 0, mode: 'web', t: 1 });
    bus.emit({ type: 'action', activity: 'sort', name: 'grab', t: 1 });
    bus.emit({ type: 'hint_shown', activity: 'sort', code: 'WRONG_BIN', source: 'ai', t: 1 });
    expect(sync.queued()).toBe(0);
  });

  it('offline -> rows are queued in storage, not sent', async () => {
    setPlayer({ classCode: 'DEMO26', nickname: 'Juma' });
    const { bus, storage, fetchFn, sync } = setup({ online: false });
    mistake(bus);
    completed(bus);
    await sync.flush();
    expect(fetchFn).not.toHaveBeenCalled();
    expect(sync.queued()).toBe(2);
    expect(storage.rows()).toHaveLength(2);
  });

  it('back online -> the online event flushes the queue', async () => {
    setPlayer({ classCode: 'DEMO26', nickname: 'Juma' });
    const { bus, net, onlineTarget, fetchFn, sync } = setup({ online: false });
    mistake(bus);
    mistake(bus, 'MISSED_GOAL');
    net.online = true;
    onlineTarget.dispatchEvent(new Event('online'));
    await sync.flush();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(sync.queued()).toBe(0);
  });

  it('failure -> rows are kept and sent on a later try', async () => {
    setPlayer({ classCode: 'DEMO26', nickname: 'Juma' });
    const { bus, net, bodies, sync } = setup({ status: 503 });
    mistake(bus);
    await sync.flush();
    expect(sync.queued()).toBe(1);
    net.status = 200;
    await sync.flush();
    expect(sync.queued()).toBe(0);
    expect(bodies).toHaveLength(2);
  });

  it('a network error keeps the rows too', async () => {
    setPlayer({ classCode: 'DEMO26', nickname: 'Juma' });
    const bus = createEventBus();
    const sync = startSync({
      bus,
      storage: new FakeStorage(),
      fetchFn: (async () => {
        throw new TypeError('Failed to fetch');
      }) as unknown as typeof fetch,
      isOnline: () => true,
    });
    syncs.push(sync);
    mistake(bus);
    await sync.flush();
    expect(sync.queued()).toBe(1);
  });

  it('flushes every 20 s', async () => {
    vi.useFakeTimers();
    setPlayer({ classCode: 'DEMO26', nickname: 'Juma' });
    const { bus, net, fetchFn, sync } = setup({ online: false });
    mistake(bus);
    await sync.flush(); // offline: nothing sent
    net.online = true; // no online event, e.g. a captive Wi-Fi coming back
    await vi.advanceTimersByTimeAsync(19_999);
    expect(fetchFn).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(sync.queued()).toBe(0);
  });

  it('sends in small batches', async () => {
    setPlayer({ classCode: 'DEMO26', nickname: 'Juma' });
    const { bus, net, bodies, sync } = setup({ online: false, batchSize: 2 });
    for (let i = 0; i < 5; i++) mistake(bus);
    net.online = true;
    await sync.flush();
    expect(bodies.map((b) => b.rows.length)).toEqual([2, 2, 1]);
    expect(sync.queued()).toBe(0);
  });

  it('caps the queue at 500 rows, dropping the oldest', () => {
    setPlayer({ classCode: 'DEMO26', nickname: 'Juma' });
    const { bus, storage, sync } = setup({ online: false });
    for (let i = 0; i < MAX_QUEUE + 20; i++) mistake(bus, 'HIT_WALL', i);
    expect(sync.queued()).toBe(MAX_QUEUE);
    expect((storage.rows()[0] as { client_t: number }).client_t).toBe(20);
  });

  it('keeps rows queued under the player of the moment', async () => {
    setPlayer({ classCode: 'DEMO26', nickname: 'Juma' });
    const { bus, storage } = setup({ online: false });
    mistake(bus);
    setPlayer({ classCode: 'CLASS7', nickname: 'Amina' });
    mistake(bus);
    expect(storage.rows().map((r) => (r as { nickname: string }).nickname)).toEqual(['Juma', 'Amina']);
  });

  it('survives storage that throws and a corrupt queue', async () => {
    setPlayer({ classCode: 'DEMO26', nickname: 'Juma' });
    const { bus, storage, sync } = setup({ online: false });
    storage.data.set(QUEUE_KEY, '{not json');
    expect(sync.queued()).toBe(0);
    storage.failWrites = true;
    expect(() => mistake(bus)).not.toThrow();
  });

  it('does not resend forever if storage cannot save after a send', async () => {
    setPlayer({ classCode: 'DEMO26', nickname: 'Juma' });
    const { bus, storage, net, fetchFn, sync } = setup({ online: false });
    mistake(bus);
    storage.failWrites = true;
    net.online = true;
    await sync.flush();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('picks up rows left in storage from a previous visit', async () => {
    setPlayer({ classCode: 'DEMO26', nickname: 'Juma' });
    const first = setup({ online: false });
    mistake(first.bus);
    first.sync.stop();
    const fetchFn = vi.fn(async () => new Response('{}', { status: 200 }));
    const sync = startSync({ bus: createEventBus(), storage: first.storage, fetchFn: fetchFn as unknown as typeof fetch, isOnline: () => true });
    syncs.push(sync);
    await sync.flush();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(sync.queued()).toBe(0);
  });
});

describe('progress rows', () => {
  const good = { class_code: 'demo26', nickname: 'Zawadi', activity: 'program', type: 'mistake', code: 'HIT_WALL', client_t: 5 };

  it('normalises class codes and nicknames', () => {
    expect(normalizeClassCode('abc123')).toBe('ABC123');
    expect(normalizeClassCode('ABC')).toBeNull();
    expect(normalizeClassCode('ABCDEFGHI')).toBeNull();
    expect(normalizeClassCode('ABC 12')).toBeNull();
    expect(normalizeNickname('Zawadi')).toBe('Zawadi');
    expect(normalizeNickname('Zawadi\n')).toBe('Zawadi');
    expect(normalizeNickname('Za\u0000wadi')).toBeNull();
    expect(normalizeNickname('😀'.repeat(20))).toBe('😀'.repeat(20));
  });

  it('keeps only the known columns', () => {
    const row = validateRow({ ...good, email: 'a@b.c', id: 9, created_at: 'x' });
    expect(Object.keys(row!).sort()).toEqual(
      ['activity', 'challenge', 'class_code', 'client_t', 'code', 'mistakes', 'nickname', 'seconds', 'stars', 'type'].sort(),
    );
    expect(row!.class_code).toBe('DEMO26');
  });

  it('rejects unknown activities, types and bad values', () => {
    expect(validateRow({ ...good, activity: 'chess' })).toBeNull();
    expect(validateRow({ ...good, type: 'action' })).toBeNull();
    expect(validateRow({ ...good, code: 'bad code' })).toBeNull();
    expect(validateRow({ ...good, type: 'activity_completed', stars: 4 })).toBeNull();
    expect(validateRow({ ...good, type: 'activity_completed' })).toBeNull();
    expect(validateRow(null)).toBeNull();
  });

  it('does not turn other events into rows', () => {
    expect(eventToRow({ type: 'action', activity: 'sort', name: 'x', t: 1 }, { classCode: 'DEMO26', nickname: 'J' })).toBeNull();
  });
});

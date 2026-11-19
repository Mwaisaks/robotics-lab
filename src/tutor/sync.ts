/**
 * Progress sync: mistake + activity_completed events -> rows -> /api/progress -> Supabase.
 * - No player set (no class code yet) -> nothing is queued or sent.
 * - Rows wait in a localStorage queue (max 500, oldest dropped) so nothing is lost offline.
 * - Flushes in small batches when online: right after an event, on the `online` event and every 20 s.
 *   A failed send keeps the rows for the next try.
 * The browser never sees Supabase keys; api/progress.ts holds them.
 */
import { events as appEvents, type EventBus } from '../core/events.js';
import { eventToRow, normalizeClassCode, normalizeNickname, type Player, type ProgressRow } from './progress-rows.js';

export const QUEUE_KEY = 'robotics-lab.sync-queue.v1';
export const MAX_QUEUE = 500;
export const BATCH_SIZE = 25;
export const FLUSH_INTERVAL_MS = 20_000;

/** The bit of Storage we use, so tests can pass a fake. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface QueuedRow {
  id: string; // local only, never sent
  row: ProgressRow;
}

let player: Player | null = null;
let defaultSync: Sync | null = null;

/**
 * Called by the class-code screen. Returns false (and stops syncing new events)
 * if the class code or nickname is invalid. Pass null to sign out.
 * Starts the default sync on first use in the browser.
 */
export function setPlayer(next: { classCode: string; nickname: string } | null): boolean {
  if (next === null) {
    player = null;
    return true;
  }
  const classCode = normalizeClassCode(next.classCode);
  const nickname = normalizeNickname(next.nickname);
  player = classCode && nickname ? { classCode, nickname } : null;
  if (player && !defaultSync && typeof window !== 'undefined') defaultSync = startSync();
  return player !== null;
}

export function getPlayer(): Player | null {
  return player;
}

export interface SyncOptions {
  bus?: EventBus;
  storage?: KeyValueStore;
  fetchFn?: typeof fetch;
  url?: string;
  isOnline?: () => boolean;
  /** Where the `online` event fires (window in the browser). */
  onlineTarget?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  intervalMs?: number;
  batchSize?: number;
}

export interface Sync {
  /** Send queued rows now (no-op when offline or already sending). Resolves when done. */
  flush(): Promise<void>;
  /** Number of rows waiting. */
  queued(): number;
  stop(): void;
}

function browserStorage(): KeyValueStore {
  const memory = new Map<string, string>();
  const fallback: KeyValueStore = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => void memory.set(k, v) };
  try {
    const ls = globalThis.localStorage;
    if (!ls) return fallback;
    return {
      getItem: (k) => {
        try {
          return ls.getItem(k);
        } catch {
          return fallback.getItem(k);
        }
      },
      setItem: (k, v) => {
        try {
          ls.setItem(k, v);
        } catch {
          fallback.setItem(k, v); // private mode / quota: keep rows in memory for this session
        }
      },
    };
  } catch {
    return fallback;
  }
}

export function startSync({
  bus = appEvents,
  storage = browserStorage(),
  fetchFn,
  url = '/api/progress',
  isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false,
  onlineTarget = typeof window !== 'undefined' ? window : undefined,
  intervalMs = FLUSH_INTERVAL_MS,
  batchSize = BATCH_SIZE,
}: SyncOptions = {}): Sync {
  let seq = 0;
  let sending: Promise<void> | null = null;

  const read = (): QueuedRow[] => {
    try {
      const parsed = JSON.parse(storage.getItem(QUEUE_KEY) ?? '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const write = (queue: QueuedRow[]): void => {
    try {
      storage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
    } catch {
      /* storage unavailable: rows for this event are lost, the game goes on */
    }
  };

  const send = async (): Promise<void> => {
    for (;;) {
      if (!isOnline()) return;
      const batch = read().slice(0, batchSize);
      if (batch.length === 0) return;
      let ok = false;
      try {
        const f = fetchFn ?? globalThis.fetch;
        const res = await f(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ rows: batch.map((q) => q.row) }),
        });
        ok = res.ok;
      } catch {
        ok = false;
      }
      if (!ok) return; // keep the rows; try again on the next trigger
      const sent = new Set(batch.map((q) => q.id));
      write(read().filter((q) => !sent.has(q.id)));
      if (read().some((q) => sent.has(q.id))) return; // storage didn't update: don't resend in a loop
    }
  };

  let again = false;
  const flush = (): Promise<void> => {
    if (sending) {
      again = true; // new rows or back online during a send: run one more pass after it
      return sending;
    }
    sending = (async () => {
      do {
        again = false;
        await send();
      } while (again);
    })().finally(() => (sending = null));
    return sending;
  };

  const off = bus.on((e) => {
    if (!player || (e.type !== 'mistake' && e.type !== 'activity_completed')) return;
    const row = eventToRow(e, player);
    if (!row) return;
    write([...read(), { id: `${Date.now().toString(36)}-${(seq++).toString(36)}`, row }]);
    void flush();
  });

  const onOnline = () => void flush();
  onlineTarget?.addEventListener('online', onOnline);
  const timer = setInterval(() => void flush(), intervalMs);
  void flush(); // rows left from a previous visit

  return {
    flush,
    queued: () => read().length,
    stop() {
      off();
      onlineTarget?.removeEventListener('online', onOnline);
      clearInterval(timer);
    },
  };
}

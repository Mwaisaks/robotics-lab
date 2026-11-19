/**
 * Class code + nickname (no real names, no other personal data), remembered on
 * this device. Pure helpers; storage is passed in so tests don't need a browser.
 */
export interface Player {
  classCode: string;
  nickname: string;
}

/** What this device remembers: a player, or that they chose "Play as guest". */
export type SavedChoice = { player: Player } | { guest: true };

export const PLAYER_KEY = 'robotics-lab.player.v1';

/** Class code: 4-8 letters or digits, upper case (same rule as the sync server). Null if invalid. */
export function cleanClassCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return /^[A-Z0-9]{4,8}$/.test(code) ? code : null;
}

/** Nickname: 2-16 characters of letters, digits, spaces, - or _, spaces collapsed. Null if invalid. */
export function cleanNickname(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ');
  return /^[\p{L}\p{N} _-]{2,16}$/u.test(name) ? name : null;
}

export function cleanPlayer(classCode: string, nickname: string): Player | null {
  const code = cleanClassCode(classCode);
  const name = cleanNickname(nickname);
  return code && name ? { classCode: code, nickname: name } : null;
}

export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function loadChoice(store: Storage | undefined): SavedChoice | null {
  try {
    const raw = store?.getItem(PLAYER_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { guest?: unknown; classCode?: unknown; nickname?: unknown };
    if (data.guest === true) return { guest: true };
    if (typeof data.classCode === 'string' && typeof data.nickname === 'string') {
      const player = cleanPlayer(data.classCode, data.nickname);
      if (player) return { player };
    }
  } catch {
    // Storage blocked or bad data: ask again.
  }
  return null;
}

export function saveChoice(store: Storage | undefined, choice: SavedChoice | null): void {
  try {
    if (choice === null) store?.removeItem(PLAYER_KEY);
    else store?.setItem(PLAYER_KEY, JSON.stringify('guest' in choice ? { guest: true } : choice.player));
  } catch {
    // Storage blocked: the choice just isn't remembered.
  }
}

import { describe, expect, it } from 'vitest';
import {
  cleanClassCode,
  cleanNickname,
  cleanPlayer,
  loadChoice,
  PLAYER_KEY,
  saveChoice,
  type Storage,
} from '../../src/shell/player.js';

function memory(): Storage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe('class code and nickname', () => {
  it('upper-cases and trims class codes (4-8 letters/digits, like the server), rejects bad ones', () => {
    expect(cleanClassCode('  mks7b ')).toBe('MKS7B');
    expect(cleanClassCode('abc')).toBeNull();
    expect(cleanClassCode('NINECHARS')).toBeNull();
    expect(cleanClassCode('MKS-7B')).toBeNull();
  });

  it('collapses spaces in nicknames and allows Kiswahili/accents', () => {
    expect(cleanNickname('  Robo   Fan ')).toBe('Robo Fan');
    expect(cleanNickname('Wanjirũ')).toBe('Wanjirũ');
    expect(cleanNickname('a')).toBeNull();
    expect(cleanNickname('x'.repeat(17))).toBeNull();
    expect(cleanNickname('<script>')).toBeNull();
  });

  it('needs both fields valid', () => {
    expect(cleanPlayer('mks7', 'Ali')).toEqual({ classCode: 'MKS7', nickname: 'Ali' });
    expect(cleanPlayer('', 'Ali')).toBeNull();
  });
});

describe('remembered choice', () => {
  it('round-trips a player and a guest choice', () => {
    const store = memory();
    saveChoice(store, { player: { classCode: 'MKS1', nickname: 'Ali' } });
    expect(loadChoice(store)).toEqual({ player: { classCode: 'MKS1', nickname: 'Ali' } });
    saveChoice(store, { guest: true });
    expect(loadChoice(store)).toEqual({ guest: true });
    saveChoice(store, null);
    expect(loadChoice(store)).toBeNull();
  });

  it('ignores bad or missing storage', () => {
    const store = memory();
    store.data.set(PLAYER_KEY, '{not json');
    expect(loadChoice(store)).toBeNull();
    store.data.set(PLAYER_KEY, JSON.stringify({ classCode: '!!', nickname: 'Ali' }));
    expect(loadChoice(store)).toBeNull();
    expect(loadChoice(undefined)).toBeNull();
    const throwing: Storage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => undefined,
    };
    expect(loadChoice(throwing)).toBeNull();
    expect(() => saveChoice(throwing, { guest: true })).not.toThrow();
  });
});

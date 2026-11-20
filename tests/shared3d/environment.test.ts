import { describe, expect, it } from 'vitest';
import {
  buildRoomBoxes,
  INDICES_PER_BOX,
  KEEP_CLEAR,
  mergeBoxes,
  splitByGroup,
  VERTS_PER_BOX,
} from '../../src/shared3d/environment/room-layout.js';
import {
  LAB_ENV,
  loadVirtualLab,
  parseVirtualLab,
  setVirtualLab,
  shouldShowRoom,
  VIRTUAL_LAB_KEY,
} from '../../src/shared3d/environment/settings.js';

describe('lab room layout', () => {
  const boxes = buildRoomBoxes();

  it('merges into two draw calls (matte + self-lit)', () => {
    const groups = splitByGroup(boxes);
    expect(groups).toHaveLength(2);
    expect(groups[0].length + groups[1].length).toBe(boxes.length);
    expect(groups[1].length).toBeGreaterThan(0);
  });

  it('packs every box into one indexed buffer', () => {
    const m = mergeBoxes(boxes);
    expect(m.boxCount).toBe(boxes.length);
    expect(m.position.length).toBe(boxes.length * VERTS_PER_BOX * 3);
    expect(m.index.length).toBe(boxes.length * INDICES_PER_BOX);
    expect(Math.max(...m.index)).toBe(boxes.length * VERTS_PER_BOX - 1);
    expect(m.position.every(Number.isFinite)).toBe(true);
  });

  it('keeps clear of the play table, arm and panel (except floor + mat)', () => {
    for (const b of boxes) {
      const top = b.c[1] + b.s[1] / 2;
      if (top <= 0) continue; // floor and work mat lie below y = 0
      const x0 = b.c[0] - b.s[0] / 2;
      const x1 = b.c[0] + b.s[0] / 2;
      const z0 = b.c[2] - b.s[2] / 2;
      const z1 = b.c[2] + b.s[2] / 2;
      const overlaps = x1 > KEEP_CLEAR.minX && x0 < KEEP_CLEAR.maxX && z1 > KEEP_CLEAR.minZ && z0 < KEEP_CLEAR.maxZ;
      // ceiling lights hang far above the table and the browser camera
      expect(overlaps && b.group !== 1, JSON.stringify(b)).toBe(false);
    }
  });
});

describe('virtual lab setting', () => {
  it('parses only "1" as on', () => {
    expect(parseVirtualLab('1')).toBe(true);
    expect(parseVirtualLab('0')).toBe(false);
    expect(parseVirtualLab(null)).toBe(false);
    expect(parseVirtualLab('yes')).toBe(false);
  });

  it('round-trips through storage and survives a throwing storage', () => {
    const map = new Map<string, string>();
    const store = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
    setVirtualLab(true, store);
    expect(LAB_ENV.virtualLabInXR).toBe(true);
    expect(map.get(VIRTUAL_LAB_KEY)).toBe('1');
    expect(loadVirtualLab(store)).toBe(true);
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => setVirtualLab(false, broken)).not.toThrow();
    expect(LAB_ENV.virtualLabInXR).toBe(false);
    expect(loadVirtualLab(broken)).toBe(false);
  });

  it('shows the room on the flat page always, in a headset only when on', () => {
    expect(shouldShowRoom(true, false)).toBe(true);
    expect(shouldShowRoom(false, false)).toBe(false);
    expect(shouldShowRoom(false, true)).toBe(true);
  });
});

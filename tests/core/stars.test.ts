import { describe, expect, it } from 'vitest';
import { mistakeStars, programStars, sortStars } from '../../src/core/stars.js';

describe('sortStars', () => {
  it('gives 1 star for playing, 2 from 50, 3 from 90', () => {
    expect(sortStars(0)).toBe(1);
    expect(sortStars(49)).toBe(1);
    expect(sortStars(50)).toBe(2);
    expect(sortStars(89)).toBe(2);
    expect(sortStars(90)).toBe(3);
  });
});

describe('programStars', () => {
  it('gives 3 for a first-run solution within par', () => {
    expect(programStars(4, 1, 4)).toBe(3);
  });
  it('gives 2 within par after more runs', () => {
    expect(programStars(4, 3, 5)).toBe(2);
  });
  it('gives 1 over par, even on the first run', () => {
    expect(programStars(6, 1, 5)).toBe(1);
  });
  it('treats a missing par as within par', () => {
    expect(programStars(8, 1)).toBe(3);
    expect(programStars(8, 2)).toBe(2);
  });
});

describe('mistakeStars', () => {
  it('gives 3 with no mistakes, 2 with up to 2, else 1', () => {
    expect(mistakeStars(0)).toBe(3);
    expect(mistakeStars(1)).toBe(2);
    expect(mistakeStars(2)).toBe(2);
    expect(mistakeStars(3)).toBe(1);
  });
});

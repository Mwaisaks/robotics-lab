import { describe, expect, it } from 'vitest';
import { MISTAKE_CODES } from '../../src/core/events.js';
import { builtinHint, builtinHintResponse, findBuiltinHint, GENERIC_HINT } from '../../src/tutor/hints.js';
import en from '../../src/tutor/hints.en.json' with { type: 'json' };
import sw from '../../src/tutor/hints.sw.json' with { type: 'json' };

describe('builtinHint', () => {
  it('returns the English hint for a known code', () => {
    expect(builtinHint('program', 'HIT_WALL', 'en')).toBe(en.program.HIT_WALL);
  });

  it('returns the Kiswahili hint for a known code', () => {
    expect(builtinHint('circuit', 'NO_RESISTOR', 'sw')).toBe(sw.circuit.NO_RESISTOR);
  });

  it('defaults to English when no language is given or the language is unknown', () => {
    expect(builtinHint('sort', 'WRONG_BIN')).toBe(en.sort.WRONG_BIN);
    expect(builtinHint('sort', 'WRONG_BIN', 'fr')).toBe(en.sort.WRONG_BIN);
  });

  it('falls back to the generic hint for an unknown code, in the requested language', () => {
    expect(builtinHint('program', 'NOT_A_CODE', 'en')).toBe(GENERIC_HINT.en);
    expect(builtinHint('program', 'NOT_A_CODE', 'sw')).toBe(GENERIC_HINT.sw);
  });

  it('falls back to the generic hint for an activity without hints yet', () => {
    expect(builtinHint('arm', 'JOINT_LIMIT', 'en')).toBe(GENERIC_HINT.en);
    expect(builtinHint('nope', 'HIT_WALL', 'sw')).toBe(GENERIC_HINT.sw);
  });

  it('does not match codes case-insensitively or through the prototype', () => {
    expect(builtinHint('program', 'hit_wall', 'en')).toBe(GENERIC_HINT.en);
    expect(findBuiltinHint('program', 'toString', 'en')).toBeUndefined();
    expect(findBuiltinHint('constructor', 'name', 'en')).toBeUndefined();
  });

  it('wraps the hint as a builtin HintResponse', () => {
    expect(builtinHintResponse({ activity: 'circuit', code: 'OPEN_LOOP', lang: 'en' })).toEqual({
      text: en.circuit.OPEN_LOOP,
      source: 'builtin',
    });
  });
});

describe('hint files cover the mistake codes', () => {
  for (const activity of ['sort', 'program', 'circuit'] as const) {
    for (const code of MISTAKE_CODES[activity]) {
      it(`${activity}/${code} has an en and sw hint`, () => {
        expect(findBuiltinHint(activity, code, 'en')).toBeTruthy();
        expect(findBuiltinHint(activity, code, 'sw')).toBeTruthy();
      });
    }
  }
});

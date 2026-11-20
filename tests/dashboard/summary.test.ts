import { describe, expect, it } from 'vitest';
import { formatDuration, formatEat, starString, summarizeClass, type ClassRow } from '../../dashboard/summary.js';
import { builtinHint } from '../../src/tutor/hints.js';

const done = (nickname: string, activity: ClassRow['activity'], stars: number, seconds: number, at = '2026-11-19T15:00:00Z'): ClassRow => ({
  nickname,
  activity,
  type: 'activity_completed',
  challenge: 0,
  code: null,
  stars,
  seconds,
  mistakes: 0,
  created_at: at,
});
const oops = (nickname: string, activity: ClassRow['activity'], code: string, at = '2026-11-19T15:00:00Z'): ClassRow => ({
  nickname,
  activity,
  type: 'mistake',
  challenge: null,
  code,
  stars: null,
  seconds: null,
  mistakes: null,
  created_at: at,
});

describe('summarizeClass', () => {
  it('builds nicknames x levels with best stars and fastest time', () => {
    const s = summarizeClass([
      done('Zawadi', 'program', 1, 200),
      done('Zawadi', 'program', 3, 150),
      done('Zawadi', 'program', 2, 90),
      done('Zawadi', 'sort', 2, 45),
      done('baraka', 'circuit', 3, 61),
    ]);
    expect(s.activities).toEqual(['sort', 'program', 'circuit']);
    expect(s.students.map((st) => st.nickname)).toEqual(['baraka', 'Zawadi']); // case-insensitive sort
    const z = s.students[1]!;
    expect(z.cells.program).toEqual({ stars: 3, bestSeconds: 90, completions: 3 });
    expect(z.cells.sort).toEqual({ stars: 2, bestSeconds: 45, completions: 1 });
    expect(z.cells.circuit).toBeUndefined();
  });

  it('lists students who only made mistakes, with empty cells', () => {
    const s = summarizeClass([oops('Juma', 'sort', 'WRONG_BIN')]);
    expect(s.students).toEqual([{ nickname: 'Juma', cells: {}, lastActive: '2026-11-19T15:00:00Z' }]);
  });

  it('tracks each student\'s latest activity', () => {
    const s = summarizeClass([done('A', 'sort', 1, 10, '2026-11-19T15:00:00Z'), oops('A', 'sort', 'WRONG_BIN', '2026-11-19T16:30:00Z'), done('A', 'sort', 1, 10, '2026-11-19T16:00:00Z')]);
    expect(s.students[0]!.lastActive).toBe('2026-11-19T16:30:00Z');
  });

  it('shows later activities only once someone finished them', () => {
    expect(summarizeClass([oops('A', 'arm', 'JOINT_LIMIT')]).activities).toEqual(['sort', 'program', 'circuit']);
    expect(summarizeClass([done('A', 'build', 3, 30)]).activities).toEqual(['sort', 'program', 'circuit', 'build']);
  });

  it('picks the top 3 mistakes with counts, students and plain-English meaning', () => {
    const s = summarizeClass([
      oops('A', 'circuit', 'LED_REVERSED'),
      oops('A', 'circuit', 'LED_REVERSED'),
      oops('B', 'circuit', 'LED_REVERSED'),
      oops('A', 'program', 'HIT_WALL'),
      oops('B', 'program', 'HIT_WALL'),
      oops('C', 'sort', 'WRONG_BIN'),
      oops('C', 'sort', 'WRONG_BIN'),
      oops('D', 'sort', 'OUT_OF_REACH'),
    ]);
    expect(s.topMistakes).toEqual([
      { activity: 'circuit', code: 'LED_REVERSED', count: 3, students: 2, meaning: builtinHint('circuit', 'LED_REVERSED', 'en') },
      // tie on count 2: more students first
      { activity: 'program', code: 'HIT_WALL', count: 2, students: 2, meaning: builtinHint('program', 'HIT_WALL', 'en') },
      { activity: 'sort', code: 'WRONG_BIN', count: 2, students: 1, meaning: builtinHint('sort', 'WRONG_BIN', 'en') },
    ]);
  });

  it('uses the generic hint as meaning for an unknown code', () => {
    expect(summarizeClass([oops('A', 'program', 'NEW_CODE')]).topMistakes[0]!.meaning).toBe(builtinHint('program', 'NEW_CODE', 'en'));
  });

  it('is empty for no rows, and skips unknown activities', () => {
    expect(summarizeClass([])).toEqual({ activities: ['sort', 'program', 'circuit'], students: [], topMistakes: [], rowCount: 0 });
    expect(summarizeClass([{ ...done('A', 'sort', 3, 1), activity: 'chess' as never }]).students).toEqual([]);
  });
});

describe('formatting', () => {
  it('formats durations as m:ss', () => {
    expect(formatDuration(95)).toBe('1:35');
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(3725)).toBe('62:05');
    expect(formatDuration(59.6)).toBe('1:00');
    expect(formatDuration(null)).toBe('');
  });

  it('draws stars out of 3', () => {
    expect(starString(0)).toBe('☆☆☆');
    expect(starString(2)).toBe('★★☆');
    expect(starString(3)).toBe('★★★');
    expect(starString(7)).toBe('★★★');
  });

  it('shows times in Kenya time (UTC+3)', () => {
    expect(formatEat('2026-11-19T18:05:00Z')).toBe('19 Nov, 21:05');
    expect(formatEat('2026-11-19T22:30:00Z')).toBe('20 Nov, 01:30'); // crosses midnight in EAT
    expect(formatEat(null)).toBe('');
    expect(formatEat('nope')).toBe('');
  });
});

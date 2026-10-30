import { describe, it, expect } from 'vitest';
import {
  MIN_LEAD_MS,
  parsePreferredTimes,
  parseProposals,
  validatePreferredTimes,
  validateProposals,
  isStartAllowed,
  overlaps,
  nextStatusAfterStudentCounter,
  resolveMode,
} from '../logic';

describe('resolveMode', () => {
  it('uses the student preference when it is not "either"', () => {
    expect(resolveMode('online', undefined, undefined)).toEqual({ mode: 'online', location: null });
    expect(resolveMode('offline', 'online', ' Room 4 ')).toEqual({ mode: 'offline', location: 'Room 4' });
  });
  it('makes the instructor choose when the preference is "either"', () => {
    expect(resolveMode('either', undefined, undefined)).toHaveProperty('error');
    expect(resolveMode('either', 'online', undefined)).toEqual({ mode: 'online', location: null });
  });
  it('requires a location for offline', () => {
    expect(resolveMode('offline', undefined, '  ')).toHaveProperty('error');
    expect(resolveMode('either', 'offline', undefined)).toHaveProperty('error');
  });
});

const NOW = Date.parse('2026-11-01T10:00:00Z');
const H = 3_600_000;
const MIN = 60_000;

describe('parsePreferredTimes / parseProposals', () => {
  it('returns [] for junk JSON', () => {
    expect(parsePreferredTimes('not json')).toEqual([]);
    expect(parsePreferredTimes('{"a":1}')).toEqual([]);
    expect(parseProposals('nope')).toEqual([]);
  });

  it('keeps only finite numbers / well-formed proposals', () => {
    expect(parsePreferredTimes(JSON.stringify([1, 'x', null, 2]))).toEqual([1, 2]);
    expect(parseProposals(JSON.stringify([{ startAt: 5 }, { startAt: 'a' }, { startAt: 6, endAt: 9 }]))).toEqual([
      { startAt: 5 },
      { startAt: 6, endAt: 9 },
    ]);
  });
});

describe('validatePreferredTimes', () => {
  it('accepts 1-4 future times', () => {
    expect(validatePreferredTimes([NOW + 2 * H], NOW)).toBeNull();
    expect(validatePreferredTimes([NOW + 2 * H, NOW + 3 * H, NOW + 4 * H, NOW + 5 * H], NOW)).toBeNull();
  });

  it('rejects empty, too many, duplicates, too soon, too far, non-numbers', () => {
    expect(validatePreferredTimes([], NOW)).toMatch(/at least one/i);
    expect(validatePreferredTimes([1, 2, 3, 4, 5].map((i) => NOW + (i + 1) * H), NOW)).toMatch(/at most 4/i);
    expect(validatePreferredTimes([NOW + 2 * H, NOW + 2 * H], NOW)).toMatch(/duplicate/i);
    expect(validatePreferredTimes([NOW + MIN_LEAD_MS - MIN], NOW)).toMatch(/at least/i);
    expect(validatePreferredTimes([NOW + 200 * 24 * H], NOW)).toMatch(/days/i);
    expect(validatePreferredTimes([NaN], NOW)).toMatch(/valid/i);
  });
});

describe('validateProposals', () => {
  const dur = 60;

  it('accepts a specific time and a range that fits the duration', () => {
    expect(validateProposals([{ startAt: NOW + 2 * H }], dur, NOW)).toBeNull();
    expect(validateProposals([{ startAt: NOW + 2 * H, endAt: NOW + 5 * H }], dur, NOW)).toBeNull();
  });

  it('rejects a range shorter than the session', () => {
    expect(validateProposals([{ startAt: NOW + 2 * H, endAt: NOW + 2 * H + 30 * MIN }], dur, NOW)).toMatch(/shorter/i);
  });

  it('rejects empty, too many, and past/too-soon proposals', () => {
    expect(validateProposals([], dur, NOW)).toMatch(/at least one/i);
    expect(validateProposals([1, 2, 3, 4, 5].map((i) => ({ startAt: NOW + (i + 1) * H })), dur, NOW)).toMatch(/at most 4/i);
    expect(validateProposals([{ startAt: NOW }], dur, NOW)).toMatch(/at least/i);
  });
});

describe('isStartAllowed', () => {
  const dur = 60 * MIN;

  it('matches a specific time exactly', () => {
    const t = NOW + 2 * H;
    expect(isStartAllowed(t, [{ startAt: t }], dur)).toBe(true);
    expect(isStartAllowed(t + MIN, [{ startAt: t }], dur)).toBe(false);
  });

  it('allows any start inside a range as long as the session still ends in it', () => {
    const range = { startAt: NOW + 2 * H, endAt: NOW + 5 * H };
    expect(isStartAllowed(range.startAt, [range], dur)).toBe(true);
    expect(isStartAllowed(range.endAt - dur, [range], dur)).toBe(true);
    expect(isStartAllowed(range.endAt - dur + MIN, [range], dur)).toBe(false);
    expect(isStartAllowed(range.startAt - MIN, [range], dur)).toBe(false);
  });
});

describe('overlaps', () => {
  it('is true for intersecting intervals, false for back-to-back', () => {
    expect(overlaps(0, 10, 5, 15)).toBe(true);
    expect(overlaps(0, 10, 10, 20)).toBe(false);
    expect(overlaps(5, 6, 0, 10)).toBe(true);
  });
});

describe('nextStatusAfterStudentCounter', () => {
  it('sends a countered request back to the instructor', () => {
    expect(nextStatusAfterStudentCounter('proposed')).toBe('pending');
  });
  it('refuses any other state', () => {
    expect(nextStatusAfterStudentCounter('pending')).toBeNull();
    expect(nextStatusAfterStudentCounter('scheduled')).toBeNull();
  });
});

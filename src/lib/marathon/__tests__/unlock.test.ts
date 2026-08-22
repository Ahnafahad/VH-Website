import { describe, it, expect } from 'vitest';
import { dayUnlockDate, isDayUnlocked, effectiveDayState, earliestStartDate } from '../unlock';

const START = new Date('2026-01-01T00:00:00Z');

describe('dayUnlockDate', () => {
  it('Day 1 unlocks exactly on the start date', () => {
    expect(dayUnlockDate(START, 1).getTime()).toBe(START.getTime());
  });

  it('Day N unlocks N-1 calendar days after the start date', () => {
    expect(dayUnlockDate(START, 4).getTime()).toBe(START.getTime() + 3 * 86_400_000);
  });
});

describe('isDayUnlocked / effectiveDayState', () => {
  it('is locked before its unlock instant', () => {
    const justBefore = new Date(dayUnlockDate(START, 5).getTime() - 1);
    expect(isDayUnlocked(START, 5, justBefore)).toBe(false);
    expect(effectiveDayState(START, 5, justBefore)).toBe('locked');
  });

  it('is unlocked exactly at, and after, its unlock instant', () => {
    const exact = dayUnlockDate(START, 5);
    expect(isDayUnlocked(START, 5, exact)).toBe(true);
    expect(effectiveDayState(START, 5, exact)).toBe('unlocked');

    const later = new Date(exact.getTime() + 30 * 86_400_000);
    expect(isDayUnlocked(START, 5, later)).toBe(true);
  });

  it('never re-locks once past its unlock date, however late "now" is', () => {
    const wayLater = new Date(START.getTime() + 365 * 86_400_000);
    expect(isDayUnlocked(START, 1, wayLater)).toBe(true);
  });
});

describe('earliestStartDate', () => {
  it('returns null for an empty list', () => {
    expect(earliestStartDate([])).toBeNull();
  });

  it('picks the earliest of several assignment start dates', () => {
    const a = new Date('2026-02-01');
    const b = new Date('2026-01-15');
    const c = new Date('2026-03-01');
    expect(earliestStartDate([a, b, c])!.getTime()).toBe(b.getTime());
  });
});

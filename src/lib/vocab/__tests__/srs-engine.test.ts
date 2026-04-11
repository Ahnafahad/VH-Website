import { describe, it, expect, vi } from 'vitest';
import { nextSrsState, isLongGap, initialSrsState, type SrsState } from '../srs/engine';

function makeState(overrides: Partial<SrsState> = {}): SrsState {
  return {
    intervalDays:   1,
    easeFactor:     2.5,
    repetitions:    0,
    nextReviewDate: new Date(),
    ...overrides,
  };
}

describe('nextSrsState', () => {
  it('increases interval and ease on got_it', () => {
    const result = nextSrsState(makeState({ repetitions: 1, intervalDays: 3 }), 'got_it');
    expect(result.easeFactor).toBeCloseTo(2.6, 2);
    expect(result.repetitions).toBe(2);
    expect(result.intervalDays).toBe(Math.ceil(3 * 2.6));
  });

  it('first repetition sets interval to 1', () => {
    const result = nextSrsState(makeState({ repetitions: 0 }), 'got_it');
    expect(result.repetitions).toBe(1);
    expect(result.intervalDays).toBe(1);
  });

  it('decreases ease on unsure, keeps interval', () => {
    const state = makeState({ intervalDays: 5, easeFactor: 2.5 });
    const result = nextSrsState(state, 'unsure');
    expect(result.easeFactor).toBeCloseTo(2.35, 2);
    expect(result.intervalDays).toBe(5); // unchanged
  });

  it('resets on missed_it', () => {
    const state = makeState({ intervalDays: 10, repetitions: 5, easeFactor: 2.5 });
    const result = nextSrsState(state, 'missed_it');
    expect(result.intervalDays).toBe(1);
    expect(result.repetitions).toBe(0);
    expect(result.easeFactor).toBeCloseTo(2.3, 2);
  });

  it('ease factor never drops below 1.3', () => {
    const state = makeState({ easeFactor: 1.3 });
    const result = nextSrsState(state, 'missed_it');
    expect(result.easeFactor).toBe(1.3);
  });

  it('sets nextReviewDate in the future', () => {
    const now = Date.now();
    const result = nextSrsState(makeState(), 'got_it');
    expect(result.nextReviewDate.getTime()).toBeGreaterThanOrEqual(now);
  });
});

describe('isLongGap', () => {
  it('returns false for null', () => {
    expect(isLongGap(null)).toBe(false);
  });

  it('returns false for recent date', () => {
    const recent = new Date(Date.now() - 5 * 86400000); // 5 days ago
    expect(isLongGap(recent)).toBe(false);
  });

  it('returns true for 30+ days ago', () => {
    const old = new Date(Date.now() - 31 * 86400000);
    expect(isLongGap(old)).toBe(true);
  });

  it('returns true for exactly 30 days', () => {
    const exactly30 = new Date(Date.now() - 30 * 86400000);
    expect(isLongGap(exactly30)).toBe(true);
  });
});

describe('initialSrsState', () => {
  it('returns default state', () => {
    const state = initialSrsState();
    expect(state.intervalDays).toBe(1);
    expect(state.easeFactor).toBe(2.5);
    expect(state.repetitions).toBe(0);
    expect(state.nextReviewDate.getTime()).toBeGreaterThan(Date.now() - 1000);
  });
});

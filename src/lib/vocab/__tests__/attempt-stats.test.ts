import { describe, it, expect } from 'vitest';
import { nextAttemptStats } from '../attempt-stats';

const prev = {
  totalAttempts:      10,
  correctAttempts:    6,
  consecutiveCorrect: 2,
  consecutiveWrong:   0,
  accuracyRate:       0.6,
};

describe('nextAttemptStats', () => {
  it('counts a correct answer and extends the correct streak', () => {
    expect(nextAttemptStats(prev, 'got_it')).toEqual({
      totalAttempts:      11,
      correctAttempts:    7,
      consecutiveCorrect: 3,
      consecutiveWrong:   0,
      accuracyRate:       7 / 11,
    });
  });

  it('counts a wrong answer and resets the correct streak', () => {
    expect(nextAttemptStats(prev, 'missed_it')).toEqual({
      totalAttempts:      11,
      correctAttempts:    6,
      consecutiveCorrect: 0,
      consecutiveWrong:   1,
      accuracyRate:       6 / 11,
    });
  });

  it('treats "unsure" as fully neutral — no attempt, no streak change', () => {
    expect(nextAttemptStats(prev, 'unsure')).toEqual({
      totalAttempts:      10,
      correctAttempts:    6,
      consecutiveCorrect: 2,
      consecutiveWrong:   0,
      accuracyRate:       0.6,
    });
  });

  it('resets the wrong streak on a correct answer', () => {
    const onWrongStreak = { ...prev, consecutiveCorrect: 0, consecutiveWrong: 4 };
    const next = nextAttemptStats(onWrongStreak, 'got_it');
    expect(next.consecutiveWrong).toBe(0);
    expect(next.consecutiveCorrect).toBe(1);
  });

  it('handles a fresh record with no prior stats', () => {
    expect(nextAttemptStats(null, 'got_it')).toEqual({
      totalAttempts:      1,
      correctAttempts:    1,
      consecutiveCorrect: 1,
      consecutiveWrong:   0,
      accuracyRate:       1,
    });
    expect(nextAttemptStats(undefined, 'unsure')).toEqual({
      totalAttempts:      0,
      correctAttempts:    0,
      consecutiveCorrect: 0,
      consecutiveWrong:   0,
      accuracyRate:       0,
    });
  });

  it('tolerates null columns on a partially-populated record', () => {
    const sparse = { totalAttempts: null, correctAttempts: null } as unknown as Parameters<typeof nextAttemptStats>[0];
    expect(nextAttemptStats(sparse, 'missed_it')).toEqual({
      totalAttempts:      1,
      correctAttempts:    0,
      consecutiveCorrect: 0,
      consecutiveWrong:   1,
      accuracyRate:       0,
    });
  });

  it('never divides by zero', () => {
    expect(nextAttemptStats({ totalAttempts: 0, correctAttempts: 0 }, 'unsure').accuracyRate).toBe(0);
  });
});

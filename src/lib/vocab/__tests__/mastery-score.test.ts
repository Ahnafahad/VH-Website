import { describe, it, expect } from 'vitest';
import {
  masteryLevel,
  quizDelta,
  flashcardDelta,
  exposureDelta,
  applyDecay,
} from '../mastery-score';

describe('masteryLevel', () => {
  it('returns "new" for scores 0–20', () => {
    expect(masteryLevel(0)).toBe('new');
    expect(masteryLevel(20)).toBe('new');
  });

  it('returns "learning" for scores 21–60', () => {
    expect(masteryLevel(21)).toBe('learning');
    expect(masteryLevel(60)).toBe('learning');
  });

  it('returns "familiar" for scores 61–120', () => {
    expect(masteryLevel(61)).toBe('familiar');
    expect(masteryLevel(120)).toBe('familiar');
  });

  it('returns "strong" for scores 121–200', () => {
    expect(masteryLevel(121)).toBe('strong');
    expect(masteryLevel(200)).toBe('strong');
  });

  it('returns "mastered" for scores > 200', () => {
    expect(masteryLevel(201)).toBe('mastered');
    expect(masteryLevel(999)).toBe('mastered');
  });
});

describe('quizDelta', () => {
  it('awards +10 for correct answer', () => {
    const result = quizDelta({ kind: 'correct', isLongGap: false }, 50);
    expect(result.scoreDelta).toBe(10);
    expect(result.newLevel).toBe('learning');
  });

  it('awards +25 for correct with long gap', () => {
    const result = quizDelta({ kind: 'correct', isLongGap: true }, 50);
    expect(result.scoreDelta).toBe(25);
    expect(result.newLevel).toBe('familiar');
  });

  it('deducts -7 for wrong_word_a', () => {
    const result = quizDelta({ kind: 'wrong_word_a' }, 50);
    expect(result.scoreDelta).toBe(-7);
    expect(result.newLevel).toBe('learning');
  });

  it('deducts -2 for wrong_word_b', () => {
    const result = quizDelta({ kind: 'wrong_word_b' }, 50);
    expect(result.scoreDelta).toBe(-2);
  });

  it('clamps score at 0 (never goes negative)', () => {
    const result = quizDelta({ kind: 'wrong_word_a' }, 3);
    expect(result.scoreDelta).toBe(-3); // 3 + (-7) = -4, clamped to 0 → delta = -3
    expect(result.newLevel).toBe('new');
  });
});

describe('flashcardDelta', () => {
  it('awards +2 for got_it', () => {
    const result = flashcardDelta('got_it', 50);
    expect(result.scoreDelta).toBe(2);
  });

  it('awards 0 for unsure', () => {
    const result = flashcardDelta('unsure', 50);
    expect(result.scoreDelta).toBe(0);
  });

  it('deducts -1 for missed_it', () => {
    const result = flashcardDelta('missed_it', 50);
    expect(result.scoreDelta).toBe(-1);
  });

  it('clamps at 0', () => {
    const result = flashcardDelta('missed_it', 0);
    expect(result.scoreDelta).toBe(0);
    expect(result.newLevel).toBe('new');
  });
});

describe('exposureDelta', () => {
  it('awards 0.5 when under cap', () => {
    const result = exposureDelta(5, 100);
    expect(result.scoreDelta).toBe(0.5);
  });

  it('awards 0 when at cap', () => {
    const result = exposureDelta(10, 100);
    expect(result.scoreDelta).toBe(0);
  });

  it('awards partial when near cap', () => {
    const result = exposureDelta(9.7, 100);
    expect(result.scoreDelta).toBeCloseTo(0.3, 5);
  });
});

describe('applyDecay', () => {
  it('no decay within grace period (7 days)', () => {
    expect(applyDecay(100, 0)).toBe(100);
    expect(applyDecay(100, 7)).toBe(100);
  });

  it('decays 2% per day after grace period', () => {
    const result = applyDecay(100, 8); // 1 day past grace
    expect(result).toBe(98); // 100 - 100*0.02 = 98
  });

  it('compounds decay over multiple days', () => {
    const result = applyDecay(100, 9); // 2 days past grace
    // Day 1: 100 - 2 = 98, Day 2: 98 - 1.96 = 96.04
    expect(result).toBeCloseTo(96.04, 2);
  });

  it('approaches 0 with extreme decay', () => {
    const result = applyDecay(1, 500); // extreme decay
    expect(result).toBeCloseTo(0, 3);
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

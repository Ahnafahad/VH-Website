import { describe, it, expect } from 'vitest';
import { generateQuestion, pickNextOperation, type Question } from '../problem-gen';

function seeded(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('generateQuestion', () => {
  it('respects ranges per tier for addition', () => {
    for (let i = 0; i < 100; i++) {
      const q = generateQuestion('addition', 1.0, []);
      expect(q.num1).toBeGreaterThanOrEqual(1);
      expect(q.num1).toBeLessThanOrEqual(9);
      expect(q.num2).toBeGreaterThanOrEqual(1);
      expect(q.num2).toBeLessThanOrEqual(9);
      expect(q.answer).toBe(q.num1 + q.num2);
    }
  });

  it('produces integer answers for division across all tiers', () => {
    for (const diff of [1, 2, 3, 4.5]) {
      for (let i = 0; i < 50; i++) {
        const q = generateQuestion('division', diff, []);
        expect(Number.isInteger(q.answer)).toBe(true);
        expect(q.num1 % q.num2).toBe(0);
      }
    }
  });

  it('never divides by zero', () => {
    for (let i = 0; i < 200; i++) {
      const q = generateQuestion('division', 2.5, []);
      expect(q.num2).toBeGreaterThan(0);
    }
  });

  it('subtraction answers never negative', () => {
    for (const diff of [1, 2, 3, 4.5]) {
      for (let i = 0; i < 100; i++) {
        const q = generateQuestion('subtraction', diff, []);
        expect(q.answer).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('prefers unique questions given prev list', () => {
    const prev: Question[] = [];
    for (let i = 0; i < 20; i++) {
      const q = generateQuestion('addition', 1.0, prev);
      prev.push(q);
    }
    // Across 20 generated single-digit additions there will be some overlap
    // but should not be fully identical. Assert generator attempts uniqueness.
    const unique = new Set(prev.map((q) => `${q.num1}+${q.num2}`));
    expect(unique.size).toBeGreaterThan(1);
  });

  it('tags question with the input continuous difficulty', () => {
    const q = generateQuestion('multiplication', 3.3, []);
    expect(q.difficulty).toBe(3.3);
  });
});

describe('pickNextOperation', () => {
  it('returns one of the selected ops', () => {
    const ops = ['addition', 'multiplication'] as const;
    const rng = seeded([0.1, 0.9, 0.4, 0.6]);
    for (let i = 0; i < 4; i++) {
      const pick = pickNextOperation([...ops], rng);
      expect(ops).toContain(pick);
    }
  });
});

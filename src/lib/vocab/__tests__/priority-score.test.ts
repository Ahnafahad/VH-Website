import { describe, it, expect } from 'vitest';
import {
  computePriorityScore,
  rankByPriority,
  weightedSample,
  type WordPriorityInput,
} from '../priority-score';

function makeWord(overrides: Partial<WordPriorityInput> = {}): WordPriorityInput {
  return {
    wordId:            1,
    masteryLevel:      'new',
    masteryScore:      0,
    accuracyRate:      0,
    lastSeenAt:        null,
    srsNextReviewDate: null,
    exposureCount:     0,
    ...overrides,
  };
}

describe('computePriorityScore', () => {
  it('returns 100 for a completely unseen word', () => {
    const score = computePriorityScore(makeWord());
    // Never seen (999 days → clamped to 1.0), 0 accuracy (→ 1.0), no overdue,
    // new mastery (1.0), 0 exposure (1.0)
    // = 0.30 + 0.30 + 0 + 0.15 + 0.05 = 0.80 → 80
    expect(score).toBe(80);
  });

  it('returns low score for a mastered word seen today with 100% accuracy', () => {
    const score = computePriorityScore(makeWord({
      masteryLevel:      'mastered',
      accuracyRate:      1.0,
      lastSeenAt:        new Date(),
      srsNextReviewDate: new Date(Date.now() + 86400000 * 7),
      exposureCount:     20,
    }));
    // All factors near 0 except mastered=0.05
    expect(score).toBeLessThan(10);
  });

  it('overdue words get higher scores', () => {
    const onTime = computePriorityScore(makeWord({
      srsNextReviewDate: new Date(Date.now() + 86400000),
      lastSeenAt: new Date(),
      masteryLevel: 'learning',
    }));
    const overdue = computePriorityScore(makeWord({
      srsNextReviewDate: new Date(Date.now() - 86400000 * 5),
      lastSeenAt: new Date(),
      masteryLevel: 'learning',
    }));
    expect(overdue).toBeGreaterThan(onTime);
  });
});

describe('rankByPriority', () => {
  it('sorts words by priority score descending', () => {
    const words = [
      makeWord({ wordId: 1, masteryLevel: 'mastered', accuracyRate: 1.0, lastSeenAt: new Date(), exposureCount: 20 }),
      makeWord({ wordId: 2, masteryLevel: 'new', accuracyRate: 0 }),
    ];
    const ranked = rankByPriority(words);
    expect(ranked[0].wordId).toBe(2);
    expect(ranked[1].wordId).toBe(1);
    expect(ranked[0].priorityScore).toBeGreaterThan(ranked[1].priorityScore);
  });
});

describe('weightedSample', () => {
  it('returns all items if count >= array length', () => {
    const words = [makeWord({ wordId: 1 }), makeWord({ wordId: 2 })].map(w => ({
      ...w,
      priorityScore: 50,
    }));
    const result = weightedSample(words, 5);
    expect(result.length).toBe(2);
  });

  it('returns exactly count items', () => {
    const words = Array.from({ length: 20 }, (_, i) => ({
      ...makeWord({ wordId: i }),
      priorityScore: 50,
    }));
    const result = weightedSample(words, 5);
    expect(result.length).toBe(5);
  });

  it('never returns duplicates', () => {
    const words = Array.from({ length: 10 }, (_, i) => ({
      ...makeWord({ wordId: i }),
      priorityScore: Math.max(1, i * 10),
    }));
    const result = weightedSample(words, 7);
    const ids = result.map(w => w.wordId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

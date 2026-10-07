import { describe, expect, it } from 'vitest';
import { computeRadar } from '../radar';

const key = new Map([[1, 'A'], [2, 'A'], [3, 'A'], [4, 'A'], [5, 'A'], [6, 'A']]);
const attempt = (attemptId: number, score: number, picks: Record<number, string | null>) =>
  ({ attemptId, score, selected: new Map(Object.entries(picks).map(([q, v]) => [Number(q), v])) });

describe('computeRadar', () => {
  // Q1,Q2 easy (everyone right), Q5,Q6 hard (only the topper right), 6 questions → third = 2.
  const topper = attempt(1, 6, { 1: 'A', 2: 'A', 3: 'A', 4: 'A', 5: 'A', 6: 'A' });
  const me = attempt(2, 3, { 1: 'A', 2: 'A', 3: 'A', 4: 'B', 5: 'B', 6: null });
  const other = attempt(3, 2, { 1: 'A', 2: 'A', 3: 'B', 4: 'B', 5: 'B', 6: 'B' });
  const axes = computeRadar({
    questionIds: [1, 2, 3, 4, 5, 6], correctKey: key, cohort: [topper, me, other],
    topAttemptIds: [1], myAttemptId: 2, totalMarks: 6,
  })!;
  const get = (k: string) => axes.find(a => a.key === k)!;

  it('scores the viewer and the top group on the same axes', () => {
    expect(get('score')).toMatchObject({ me: 50, top5: 100 });
    expect(get('accuracy')).toMatchObject({ me: 60, top5: 100 });   // 3 right of 5 answered
    expect(get('attempt')).toMatchObject({ me: 83.3, top5: 100 });  // 5 of 6 answered
    expect(get('easy')).toMatchObject({ me: 100, top5: 100 });
    expect(get('hard')).toMatchObject({ me: 0, top5: 100 });
  });

  it('returns null when there is nobody to compare against', () => {
    expect(computeRadar({ questionIds: [1], correctKey: key, cohort: [me], topAttemptIds: [2], myAttemptId: 2, totalMarks: 6 })).toBeNull();
  });
});

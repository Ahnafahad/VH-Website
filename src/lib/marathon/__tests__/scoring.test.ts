import { describe, it, expect } from 'vitest';
import { scoreMarathonAttempt } from '../scoring';

const QUESTIONS = [
  { id: 1, correctKey: 'A' },
  { id: 2, correctKey: 'B' },
  { id: 3, correctKey: 'C' },
];

describe('scoreMarathonAttempt', () => {
  it('counts correct, wrong and skipped with no negative marking', () => {
    const answers = new Map<number, string | null>([
      [1, 'A'],   // correct
      [2, 'D'],   // wrong
      [3, null],  // skipped
    ]);
    const score = scoreMarathonAttempt(QUESTIONS, answers);
    expect(score).toEqual({ totalCorrect: 1, totalWrong: 1, totalSkipped: 1, totalQuestions: 3 });
  });

  it('treats an unvisited question (absent from the map) the same as skipped', () => {
    const answers = new Map<number, string | null>([[1, 'A']]);
    const score = scoreMarathonAttempt(QUESTIONS, answers);
    expect(score.totalSkipped).toBe(2);
  });

  it('a wrong answer never subtracts from the score — plain correct-count only', () => {
    const answers = new Map<number, string | null>([[1, 'Z'], [2, 'Z'], [3, 'Z']]);
    const score = scoreMarathonAttempt(QUESTIONS, answers);
    expect(score.totalCorrect).toBe(0);
    expect(score.totalWrong).toBe(3);
  });
});

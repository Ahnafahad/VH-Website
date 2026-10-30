import { describe, expect, it } from 'vitest';
import { computeMissedChances } from '../missed-chances';

// Cohort of 10. Section "English": q1 8 right (easy), q2 5 right, q3 1 right (hard), q4 9 right.
const analytics = {
  1: { correctCount: 8, wrongCount: 2, skippedCount: 0 },
  2: { correctCount: 5, wrongCount: 3, skippedCount: 2 },
  3: { correctCount: 1, wrongCount: 9, skippedCount: 0 },
  4: { correctCount: 9, wrongCount: 0, skippedCount: 1 },
  5: { correctCount: 7, wrongCount: 3, skippedCount: 0 },
};
const input = {
  sections: [
    { id: 1, title: 'English', penaltyPerWrong: 0.25, questions: [1, 2, 3, 4].map(n => ({ id: n, number: n })) },
    { id: 2, title: 'Math', penaltyPerWrong: 0.25, questions: [{ id: 5, number: 1 }] },
  ],
  analytics,
  responses: {
    1: { selected: 'B', correct: 'A', isCorrect: false },  // wrong, 80% got it
    2: { selected: null, correct: 'C', isCorrect: null },   // skipped, 50%
    3: { selected: 'A', correct: 'D', isCorrect: false },   // wrong, only 10% → below the floor
    4: { selected: 'A', correct: 'A', isCorrect: true },    // right → never a missed chance
    5: { selected: 'E', correct: 'E', isCorrect: true },
  },
};

describe('computeMissedChances', () => {
  const [english, math] = computeMissedChances(input);

  it('lists easiest-missed first and ignores answered-right and too-hard questions', () => {
    expect(english.chances.map(c => c.number)).toEqual([1, 2]);
    expect(english.chances[0]).toMatchObject({ cohortCorrectPct: 80, mine: 'wrong', yourAnswer: 'B', correctAnswer: 'A' });
    expect(english.chances[1]).toMatchObject({ cohortCorrectPct: 50, mine: 'skipped', yourAnswer: null });
  });

  it('counts every miss for the section totals, even ones below the floor', () => {
    expect(english).toMatchObject({ wrong: 2, skipped: 1, penaltyLost: 0.5 });
  });

  it('gives a section with no misses an empty list', () => {
    expect(math).toMatchObject({ wrong: 0, skipped: 0, penaltyLost: 0, chances: [] });
  });

  it('caps the list per section', () => {
    expect(computeMissedChances(input, 1, 30)[0].chances).toHaveLength(1);
  });
});

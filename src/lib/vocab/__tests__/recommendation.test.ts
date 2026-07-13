import { describe, expect, it } from 'vitest';
import { chooseRecommendation } from '../recommendation';

describe('chooseRecommendation', () => {
  it('resumes an unfinished quiz before all other work', () => {
    expect(chooseRecommendation({ activeQuiz: { id: 7, href: '/vocab/study/2/quiz', answered: 2, total: 8 }, dueCount: 9, weakCount: 5 }).kind).toBe('resume_quiz');
  });
  it('prioritizes due recall over new learning', () => {
    expect(chooseRecommendation({ dueCount: 4, weakCount: 2, learn: { themeId: 1, name: 'Foundations', wordCount: 10, inProgress: false } }).kind).toBe('due_review');
  });
  it('continues an interrupted learning set before a prepared quiz', () => {
    expect(chooseRecommendation({ dueCount: 0, weakCount: 0, learn: { themeId: 2, name: 'Precision', wordCount: 8, inProgress: true }, quiz: { themeId: 1, name: 'Foundations', wordCount: 10 } }).kind).toBe('resume_learning');
  });
  it('repairs weak words before starting a new set', () => {
    expect(chooseRecommendation({ dueCount: 0, weakCount: 3 }).kind).toBe('repair');
  });
});

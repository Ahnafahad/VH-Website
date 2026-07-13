import { describe, expect, it } from 'vitest';
import { buildDeterministicQuestionCopy, type QuizQuestionInput } from '../quiz-generator';

function input(type: QuizQuestionInput['type'], exampleSentence = 'Her sagacious advice prevented a costly mistake.'): QuizQuestionInput {
  const word = {
    id: 1,
    word: 'sagacious',
    definition: 'having good judgement',
    synonyms: ['wise'],
    antonyms: ['foolish'],
    exampleSentence,
    partOfSpeech: 'adjective',
    themeId: 1,
    unitId: 1,
    difficultyBase: 2,
  };
  return {
    correct: word,
    selection: { distractors: [], allOptions: [word], correctIndex: 0, correctLetter: 'A' },
    type,
    difficulty: 'easy',
  };
}

describe('deterministic quiz fallback', () => {
  it('creates a definition prompt for typed recall', () => {
    const result = buildDeterministicQuestionCopy(input('type_word'));
    expect(result.questionText).toContain('Type the word');
    expect(result.questionText).not.toContain('sagacious');
  });

  it('creates a cloze without leaking the answer', () => {
    const result = buildDeterministicQuestionCopy(input('fill_blank'));
    expect(result.questionText).toContain('_____');
    expect(result.questionText.toLowerCase()).not.toContain('sagacious');
  });

  it('falls back to a definition when no example can be blanked', () => {
    const result = buildDeterministicQuestionCopy(input('analogy', 'A different example.'));
    expect(result.questionText).toContain('having good judgement');
  });
});

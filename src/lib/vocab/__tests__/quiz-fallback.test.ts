import { describe, expect, it, vi } from 'vitest';

// quiz-generator now imports error-log → db; mock it so tests stay unit-isolated.
vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
  },
  vocabErrorLogs: {},
}));

import { buildCorrectUsageQuestion, buildDeterministicQuestionCopy, type QuizQuestionInput } from '../quiz-generator';

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

describe('correct_usage question', () => {
  const ai = {
    questionText: 'ignored',
    explanation:  'Only the first fits.',
    correctSentence: 'Her sagacious advice prevented a mistake.',
    wrongSentences:  ['A sagacious rock fell down the hill.', 'He was sagacious about being foolish.'],
  };

  it('offers the three sentences as options and keys the correct letter to the right one', () => {
    for (let n = 0; n < 30; n++) {
      const q = buildCorrectUsageQuestion(input('correct_usage'), ai)!;
      expect(q.options).toHaveLength(3);
      expect(q.optionKind).toBe('string');
      expect(q.options.find(o => o.letter === q.correctLetter)!.word).toBe(ai.correctSentence);
    }
  });

  it('rejects results without 3 distinct sentences that all contain the word', () => {
    const q = input('correct_usage');
    expect(buildCorrectUsageQuestion(q, { ...ai, correctSentence: undefined })).toBeNull();
    expect(buildCorrectUsageQuestion(q, { ...ai, wrongSentences: ['Only one sagacious.'] })).toBeNull();
    expect(buildCorrectUsageQuestion(q, { ...ai, wrongSentences: [ai.correctSentence, 'Another sagacious one.'] })).toBeNull();
    expect(buildCorrectUsageQuestion(q, { ...ai, wrongSentences: ['No target word here.', 'A sagacious one.'] })).toBeNull();
  });
});

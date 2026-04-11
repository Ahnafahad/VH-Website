import { describe, it, expect } from 'vitest';
import { selectDistractors, type WordForDistractor } from '../distractor-selector';

function makeWord(id: number, overrides: Partial<WordForDistractor> = {}): WordForDistractor {
  return {
    id,
    word:            `word${id}`,
    definition:      `def${id}`,
    synonyms:        [],
    antonyms:        [],
    exampleSentence: `example${id}`,
    partOfSpeech:    'noun',
    themeId:         1,
    unitId:          1,
    difficultyBase:  1,
    ...overrides,
  };
}

function makeMixedPool(): WordForDistractor[] {
  return [
    // Tier 1: same theme
    ...Array.from({ length: 3 }, (_, i) => makeWord(i + 2, { themeId: 1, unitId: 1 })),
    // Tier 2: same unit, different theme, different POS (avoids Tier 1 promotion)
    ...Array.from({ length: 4 }, (_, i) => makeWord(i + 10, { themeId: 2, unitId: 1, partOfSpeech: 'verb' })),
    // Tier 3: different unit entirely
    ...Array.from({ length: 3 }, (_, i) => makeWord(i + 20, { themeId: 5, unitId: 3, partOfSpeech: 'adj' })),
  ];
}

describe('selectDistractors', () => {
  const correct = makeWord(1, { themeId: 1, unitId: 1 });

  it('selects exactly 4 distractors from pool', () => {
    const pool = makeMixedPool();
    const result = selectDistractors(correct, pool, [], 0);
    expect(result.distractors.length).toBe(4);
    expect(result.allOptions.length).toBe(5);
  });

  it('excludes the correct word from distractors', () => {
    const pool = [correct, ...makeMixedPool()];
    const result = selectDistractors(correct, pool, [], 0);
    expect(result.distractors.every(d => d.id !== correct.id)).toBe(true);
  });

  it('places correct answer at correctIndex', () => {
    const pool = makeMixedPool();
    const result = selectDistractors(correct, pool, [], 0);
    expect(result.allOptions[result.correctIndex].id).toBe(correct.id);
  });

  it('correctLetter matches correctIndex', () => {
    const pool = makeMixedPool();
    const result = selectDistractors(correct, pool, [], 0);
    const letters = ['A', 'B', 'C', 'D', 'E'] as const;
    expect(result.correctLetter).toBe(letters[result.correctIndex]);
  });

  it('prefers same-theme words (Tier 1)', () => {
    const sameTheme = Array.from({ length: 5 }, (_, i) =>
      makeWord(i + 2, { themeId: 1, unitId: 1 }),
    );
    const diffUnit = Array.from({ length: 5 }, (_, i) =>
      makeWord(i + 10, { themeId: 5, unitId: 3 }),
    );
    const pool = [...sameTheme, ...diffUnit];
    const result = selectDistractors(correct, pool, [], 0);

    // Most distractors should be from the same theme
    const sameThemeCount = result.distractors.filter(d => d.themeId === 1).length;
    expect(sameThemeCount).toBeGreaterThanOrEqual(3);
  });

  it('handles small pool gracefully', () => {
    const pool = [makeWord(2), makeWord(3)]; // only 2 distractors available
    const result = selectDistractors(correct, pool, [], 0);
    expect(result.distractors.length).toBe(2);
    expect(result.allOptions.length).toBe(3);
  });

  it('uses confusion pairs when totalAnswers >= 10', () => {
    const confusionWord = makeWord(5, { themeId: 99, unitId: 99 }); // Tier 3 normally
    const pool = [
      confusionWord,
      ...Array.from({ length: 8 }, (_, i) => makeWord(i + 10, { themeId: 1 })),
    ];
    const confusionPairs = [{ wordBId: 5, count: 3 }];
    const result = selectDistractors(correct, pool, confusionPairs, 15);

    // confusion word should be elevated to Tier 1 and selected
    expect(result.distractors.some(d => d.id === 5)).toBe(true);
  });
});

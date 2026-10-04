import { describe, expect, it } from 'vitest';
import { fixtureSets } from '../content/fixtures';
import { classifyAnswer } from '../core/learning';

describe('last word checkpoint', () => {
  it('all four fixture sets satisfy the content schema', () => {
    expect(fixtureSets.map(set => set.set_id).sort()).toEqual(
      ['assure-ensure', 'confident-arrogant', 'frugal-thrifty-miserly', 'persistent-obstinate']);
  });

  it('every beat names a best word from its set, and that word classifies as best', () => {
    for (const set of fixtureSets) {
      const words = set.words.map(word => word.word);
      for (const beat of set.chains.flatMap(chain => chain.beats)) {
        expect(words).toContain(beat.best_word);
        expect(classifyAnswer(beat, beat.best_word)).toBe('best');
      }
    }
  });
});

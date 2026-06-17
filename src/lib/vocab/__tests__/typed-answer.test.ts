import { describe, it, expect } from 'vitest';
import { isTypedAnswerCorrect, normalizeTypedAnswer } from '../typed-answer';

describe('normalizeTypedAnswer', () => {
  it('lowercases, trims, and collapses whitespace', () => {
    expect(normalizeTypedAnswer('  Ephemeral  ')).toBe('ephemeral');
    expect(normalizeTypedAnswer('AD   HOC')).toBe('ad hoc');
  });
});

describe('isTypedAnswerCorrect', () => {
  it('accepts exact matches regardless of case and whitespace', () => {
    expect(isTypedAnswerCorrect('Ephemeral ', 'ephemeral')).toBe(true);
    expect(isTypedAnswerCorrect('GREGARIOUS', 'gregarious')).toBe(true);
  });

  it('rejects empty answers', () => {
    expect(isTypedAnswerCorrect('', 'ephemeral')).toBe(false);
    expect(isTypedAnswerCorrect('   ', 'ephemeral')).toBe(false);
  });

  it('tolerates one typo for words of 6+ letters', () => {
    expect(isTypedAnswerCorrect('ephemerel', 'ephemeral')).toBe(true);  // substitution
    expect(isTypedAnswerCorrect('ephemral',  'ephemeral')).toBe(true);  // deletion
    expect(isTypedAnswerCorrect('ephemerall','ephemeral')).toBe(true);  // insertion
  });

  it('rejects two typos', () => {
    expect(isTypedAnswerCorrect('ephimerel', 'ephemeral')).toBe(false);
  });

  it('does not tolerate typos for short words', () => {
    expect(isTypedAnswerCorrect('vex', 'hex')).toBe(false);
    expect(isTypedAnswerCorrect('tacid', 'tacit')).toBe(false); // 5 letters
  });

  it('rejects a completely different word', () => {
    expect(isTypedAnswerCorrect('gregarious', 'ephemeral')).toBe(false);
  });
});

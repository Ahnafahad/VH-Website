import { describe, it, expect } from 'vitest';
import { suggestMaterialFields } from '../suggest';
import { ExistingMaterial } from '../predict';

describe('suggestMaterialFields', () => {
  it('predicts the next number in sequence (1.1/1.2/1.3 -> 1.4)', () => {
    const existing: ExistingMaterial[] = [
      { course: 'iba', subject: 'math', docType: 'lecture', number: '1.1' },
      { course: 'iba', subject: 'math', docType: 'lecture', number: '1.2' },
      { course: 'iba', subject: 'math', docType: 'lecture', number: '1.3' },
    ];

    const result = suggestMaterialFields('IBA Maths - Lecture.pdf', { existing });

    expect(result.number).toBe('1.4');
    expect(result.provenance.number).toBe('sequence');
    expect(result.subject).toBe('math');
    expect(result.provenance.subject).toBe('filename');
  });

  it('falls back to last-used subject when the filename has no subject signal', () => {
    const result = suggestMaterialFields(
      'Chapter4-Advanced-Sentence-Structures-Lecture-Sheet.pdf',
      { lastUsed: { subject: 'english' } },
    );

    expect(result.subject).toBe('english');
    expect(result.provenance.subject).toBe('last-used');
    // filename-derived fields are untouched by the last-used fallback
    expect(result.docType).toBe('lecture');
    expect(result.provenance.docType).toBe('filename');
    expect(result.number).toBe('4');
    expect(result.topic).toBe('Advanced Sentence Structures');
    expect(result.title).toBe('IBA English Lecture 4 — Advanced Sentence Structures');
  });

  it('resolves doc type to solution when both Lecture and Solution tokens are present', () => {
    const result = suggestMaterialFields('IBA Maths - Lecture 1.1 - Solution.pdf');

    expect(result.docType).toBe('solution');
    expect(result.provenance.docType).toBe('filename');
    expect(result.title).toBe('IBA Math Solution 1.1');
  });

  it('still resolves course to iba with no brand token and no context (only course in taxonomy)', () => {
    const result = suggestMaterialFields('random-unrecognized-file.pdf');

    expect(result.course).toBe('iba');
  });
});

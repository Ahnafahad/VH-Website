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
      // course must also come from last-used now — with 2 courses in the
      // taxonomy, a filename with no brand token no longer implies one.
      { lastUsed: { course: 'iba', subject: 'english' } },
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

  it('leaves course null with no brand token and no context (ambiguous between iba/fbs)', () => {
    const result = suggestMaterialFields('random-unrecognized-file.pdf');

    expect(result.course).toBe(null);
  });

  // Production rows 13-15/17 (see naming-accuracy-report.md) were stored with
  // subject "tbd", null docType/number, and a raw-filename title, even though
  // this is the exact filename shape parseFilename/suggestMaterialFields
  // handle confidently. This test pins down that the confident prediction
  // itself is correct end to end (all fields + assembled title) — proving the
  // drop happens downstream of this pure function, not inside it.
  it('produces a fully-assembled, non-null title for an unambiguous filename (regression guard for prod rows 13-15/17)', () => {
    const result = suggestMaterialFields('IBA Maths - Lecture 1.5.pdf');

    expect(result.subject).toBe('math');
    expect(result.docType).toBe('lecture');
    expect(result.number).toBe('1.5');
    expect(result.title).toBe('IBA Math Lecture 1.5');
  });
});

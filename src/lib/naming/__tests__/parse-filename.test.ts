import { describe, it, expect } from 'vitest';
import { parseFilename } from '../parse-filename';

/**
 * Expected values copied VERBATIM from the independently authored oracle
 * (material-oracle.json, 10 real material filenames). `null` means the
 * filename genuinely does not contain that field — the parser must abstain,
 * not guess. Do not alter these values; see the session report for the one
 * field (`course`) where the oracle disagrees with the literal wording of
 * the spec's brand-prefix rule, and how that was resolved.
 */
const ORACLE = [
  {
    id: 1,
    fileName: 'BTH English Lecture Sheet 1.pdf',
    // Was 'iba' when the taxonomy had only one course — 'BTH' is the general
    // brand token (applies to both IBA and FBS), not a course-specific one,
    // so now that 'fbs' exists too this is genuinely ambiguous and abstains.
    expected: { course: null, subject: 'english', docType: 'lecture', number: '1', topic: null },
  },
  {
    id: 3,
    fileName: 'BH_BBA_English_Lecture_2 (2).pdf',
    expected: { course: 'iba', subject: 'english', docType: 'lecture', number: '2', topic: null },
  },
  {
    id: 4,
    fileName: 'IBA Maths - Lecture 1.1.pdf',
    expected: { course: 'iba', subject: 'math', docType: 'lecture', number: '1.1', topic: null },
  },
  {
    id: 5,
    fileName: 'IBA Maths - Lecture 1.2.pdf',
    expected: { course: 'iba', subject: 'math', docType: 'lecture', number: '1.2', topic: null },
  },
  {
    id: 6,
    fileName: 'BBA-English-Ch3-Vocabulary-Guide.pdf',
    expected: { course: 'iba', subject: 'english', docType: null, number: '3', topic: 'Vocabulary Guide' },
  },
  {
    id: 7,
    fileName: 'IBA Maths - Lecture 1.3.pdf',
    expected: { course: 'iba', subject: 'math', docType: 'lecture', number: '1.3', topic: null },
  },
  {
    id: 8,
    fileName: 'IBA Maths - Lecture 1.1 - Solution.pdf',
    expected: { course: 'iba', subject: 'math', docType: 'solution', number: '1.1', topic: null },
  },
  {
    id: 9,
    fileName: 'IBA Maths - Lecture 1.2 - Solution.pdf',
    expected: { course: 'iba', subject: 'math', docType: 'solution', number: '1.2', topic: null },
  },
  {
    id: 10,
    fileName: 'IBA Maths - Lecture 1.3 - Solution.pdf',
    expected: { course: 'iba', subject: 'math', docType: 'solution', number: '1.3', topic: null },
  },
  {
    id: 11,
    fileName: 'Chapter4-Advanced-Sentence-Structures-Lecture-Sheet.pdf',
    // Was 'iba' when the taxonomy had only one course (any filename could
    // default to it unambiguously); now that 'fbs' exists too, a filename
    // with no brand token is genuinely ambiguous and the parser abstains.
    expected: { course: null, subject: null, docType: 'lecture', number: '4', topic: 'Advanced Sentence Structures' },
  },
] as const;

describe('parseFilename — oracle fixtures', () => {
  for (const { id, fileName, expected } of ORACLE) {
    describe(`id ${id}: "${fileName}"`, () => {
      const result = parseFilename(fileName);

      it('course', () => expect(result.course).toBe(expected.course));
      it('subject', () => expect(result.subject).toBe(expected.subject));
      it('docType', () => expect(result.docType).toBe(expected.docType));
      it('number', () => expect(result.number).toBe(expected.number));
      it('topic', () => expect(result.topic).toBe(expected.topic));
    });
  }
});

describe('parseFilename — plural doc-type vocabulary (production row 12)', () => {
  // Production row 12: "Chapter4-Advanced-Sentence-Structures-Solutions.pdf".
  // The plural "Solutions" was missing from DOC_TYPE_SINGLE_WORDS, so it fell
  // through to the topic leftover pool instead of being recognized as docType.
  it('recognizes plural "Solutions" as docType solution, not topic leakage', () => {
    const result = parseFilename('Chapter4-Advanced-Sentence-Structures-Solutions.pdf');
    expect(result.docType).toBe('solution');
    expect(result.number).toBe('4');
    expect(result.topic).toBe('Advanced Sentence Structures');
  });

  it('still recognizes singular "Solution"', () => {
    const result = parseFilename('IBA Maths - Lecture 1.1 - Solution.pdf');
    expect(result.docType).toBe('solution');
  });
});

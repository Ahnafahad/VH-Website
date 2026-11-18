/**
 * Allowed values for test_questions.tag on BTH (IBA) mocks, one tag per question.
 * English and Analytical are tagged by question type, Mathematics by topic.
 * Every new mock must be tagged on import (see scripts/tag-mock-questions.mjs).
 */

export const ENGLISH_TAGS = [
  'Reading Comprehension',
  'Vocabulary',
  'Analogy',
  'Grammar: Sentence Correction',
  'Grammar: Error Detection',
  'Grammar: Fill-in',
] as const;

export const ANALYTICAL_TAGS = [
  'Puzzle',
  'Data Sufficiency',
  'Critical Reasoning',
] as const;

export const MATH_TAGS = [
  'Integers, Odd/Even, Consecutive',
  'Basic Operations, Factors, Multiples',
  'Divisibility, Primes, HCF/LCM',
  'Fractions & Decimals',
  'Real Numbers, Number Line, Absolute Value',
  'Exponents & Roots',
  'Sequences',
  'Average',
  'Ages',
  'Numbers (Word Problems)',
  'Percentage',
  'Profit & Loss',
  'Interest',
  'Inequalities',
  'Ratio & Proportion',
  'Distance, Speed & Time',
  'Work',
  'Sets',
  'Mixture',
  'Permutation, Combination & Probability',
  'Angles & Triangles',
  'Quadrilaterals & Polygons',
  'Circles',
  'Solid Geometry',
  'Coordinate Geometry',
  'Mixed Geometry',
  'Algebra: Equations & Functions',
] as const;

export type SectionKind = 'english' | 'math' | 'analytical';

/** Maps a mock section title to its tag family. */
export function sectionKind(title: string): SectionKind | null {
  if (/^lang|english/i.test(title)) return 'english';
  if (/^math/i.test(title)) return 'math';
  if (/^analyt/i.test(title)) return 'analytical';
  return null;
}

export const TAGS_BY_KIND: Record<SectionKind, readonly string[]> = {
  english: ENGLISH_TAGS,
  math: MATH_TAGS,
  analytical: ANALYTICAL_TAGS,
};

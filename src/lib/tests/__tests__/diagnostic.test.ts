import { describe, expect, it } from 'vitest';
import { essayIndexesForSections, pickAttemptedSections } from '../diagnostic';

const sections = [
  { id: 10, title: 'General English' },
  { id: 11, title: 'Advanced English' },
  { id: 12, title: 'Business Studies' },
  { id: 13, title: 'Economics' },
  { id: 14, title: 'Accounting' },
];

describe('pickAttemptedSections', () => {
  it('adds both English sections to the two picked electives', () => {
    expect(pickAttemptedSections(sections, [14, 12], 2)).toEqual([10, 11, 14, 12]);
  });
  it('rejects the wrong number, duplicates, compulsory or unknown ids', () => {
    expect(pickAttemptedSections(sections, [12], 2)).toBeNull();
    expect(pickAttemptedSections(sections, [12, 12], 2)).toBeNull();
    expect(pickAttemptedSections(sections, [12, 10], 2)).toBeNull();
    expect(pickAttemptedSections(sections, [12, 99], 2)).toBeNull();
    expect(pickAttemptedSections(sections, [12, 13, 14], 2)).toBeNull();
  });
});

describe('essayIndexesForSections', () => {
  it('maps attempted sections to 1-based essay positions in paper order', () => {
    expect(essayIndexesForSections(sections.map(s => s.id), [10, 11, 13, 14])).toEqual([1, 2, 4, 5]);
    expect(essayIndexesForSections(sections.map(s => s.id), [])).toEqual([]);
  });
});

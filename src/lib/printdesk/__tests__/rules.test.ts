import { describe, expect, it } from 'vitest';
import { canStaffMove, isPrintableMaterial, packSummary, validateSelection } from '../rules';

describe('isPrintableMaterial', () => {
  it('allows PDFs except solutions and homework answer keys', () => {
    expect(isPrintableMaterial({ type: 'pdf', docType: 'lecture' }, new Set(), 1)).toBe(true);
    expect(isPrintableMaterial({ type: 'pdf', docType: null }, new Set(), 1)).toBe(true);
    expect(isPrintableMaterial({ type: 'pdf', docType: 'solution' }, new Set(), 1)).toBe(false);
    expect(isPrintableMaterial({ type: 'link', docType: 'lecture' }, new Set(), 1)).toBe(false);
    expect(isPrintableMaterial({ type: 'pdf', docType: 'homework' }, new Set([7]), 7)).toBe(false);
  });
});

describe('validateSelection', () => {
  const printable = new Set([1, 2, 3]);
  it('de-duplicates and accepts available materials', () => {
    expect(validateSelection([1, 2, 2], printable, new Set())).toEqual({ ids: [1, 2] });
  });
  it('rejects empty, unavailable and already-requested selections', () => {
    expect(validateSelection([], printable, new Set())).toHaveProperty('error');
    expect(validateSelection([9], printable, new Set())).toHaveProperty('error');
    expect(validateSelection([1], printable, new Set([1]))).toHaveProperty('error');
    expect(validateSelection('1', printable, new Set())).toHaveProperty('error');
  });
});

describe('canStaffMove', () => {
  it('follows requested → printed → collected, with reject', () => {
    expect(canStaffMove('requested', 'printed')).toBe(true);
    expect(canStaffMove('printed', 'collected')).toBe(true);
    expect(canStaffMove('requested', 'rejected')).toBe(true);
    expect(canStaffMove('requested', 'collected')).toBe(false);
    expect(canStaffMove('cancelled', 'printed')).toBe(false);
    expect(canStaffMove('rejected', 'printed')).toBe(false);
  });
});

describe('packSummary', () => {
  it('lists copies per material and who asked', () => {
    const text = packSummary(
      [
        { materialId: 1, title: 'Lecture 1', subject: 'English', students: ['Rafi', 'Nadia'] },
        { materialId: 3, title: 'Practice 3', subject: 'Math', students: ['Tanvir'] },
      ],
      new Map([[1, '01-Lecture-1.pdf'], [3, '02-Practice-3.pdf']]),
      new Date('2026-10-10T10:00:00Z'),
    );
    expect(text).toContain('2 materials, 3 copies in total');
    expect(text).toContain('1. Lecture 1 — 2 copies');
    expect(text).toContain('2. Practice 3 — 1 copy');
    expect(text).toContain('     - Nadia');
  });
});

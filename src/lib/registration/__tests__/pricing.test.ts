import { describe, it, expect } from 'vitest';
import {
  MOCK_PRICES,
  calculateMocksPricing,
  isMockProgram,
  isFullCourse,
  type MockProgram,
} from '../pricing';

describe('calculateMocksPricing', () => {
  it('zero mocks → all zeros', () => {
    expect(calculateMocksPricing([])).toEqual({ subtotal: 0, discount: 0, finalPrice: 0 });
  });

  it('1 mock → 0% discount', () => {
    const r = calculateMocksPricing(['du-iba']);
    expect(r.subtotal).toBe(3000);
    expect(r.discount).toBe(0);
    expect(r.finalPrice).toBe(3000);
  });

  it('2 mocks → 5% discount', () => {
    const r = calculateMocksPricing(['du-iba', 'bup-iba']);
    expect(r.subtotal).toBe(5200);
    expect(r.discount).toBe(Math.round(5200 * 0.05));
    expect(r.finalPrice).toBe(r.subtotal - r.discount);
  });

  it('3 mocks → 15% discount', () => {
    const r = calculateMocksPricing(['du-iba', 'bup-iba', 'du-fbs']);
    expect(r.subtotal).toBe(7700);
    expect(r.discount).toBe(Math.round(7700 * 0.15));
    expect(r.finalPrice).toBe(r.subtotal - r.discount);
  });

  it('4 mocks → 25% discount', () => {
    const mocks: MockProgram[] = ['du-iba', 'bup-iba', 'du-fbs', 'bup-fbs'];
    const r = calculateMocksPricing(mocks);
    const expectedSubtotal = Object.values(MOCK_PRICES).reduce((s, v) => s + v, 0);
    expect(r.subtotal).toBe(expectedSubtotal);
    expect(r.discount).toBe(Math.round(expectedSubtotal * 0.25));
    expect(r.finalPrice).toBe(r.subtotal - r.discount);
  });

  it('discount is an integer (rounded)', () => {
    const r = calculateMocksPricing(['du-iba', 'bup-iba']);
    expect(Number.isInteger(r.discount)).toBe(true);
  });
});

describe('isMockProgram', () => {
  it('accepts known mocks', () => {
    expect(isMockProgram('du-iba')).toBe(true);
    expect(isMockProgram('bup-fbs')).toBe(true);
  });

  it('rejects unknown strings', () => {
    expect(isMockProgram('foo')).toBe(false);
    expect(isMockProgram('iba-combined')).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isMockProgram(42)).toBe(false);
    expect(isMockProgram(null)).toBe(false);
    expect(isMockProgram(undefined)).toBe(false);
    expect(isMockProgram({})).toBe(false);
  });
});

describe('isFullCourse', () => {
  it('accepts known full courses', () => {
    expect(isFullCourse('iba-combined')).toBe(true);
    expect(isFullCourse('du-fbs-full')).toBe(true);
  });

  it('rejects unknown', () => {
    expect(isFullCourse('du-iba')).toBe(false);
    expect(isFullCourse('fake')).toBe(false);
    expect(isFullCourse(123)).toBe(false);
  });
});

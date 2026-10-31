import { describe, expect, it } from 'vitest';
import { accessUntil, normalizeBdPhone, paymentReference } from '../registration-pure';

describe('normalizeBdPhone', () => {
  it('accepts local, 880 and +880 forms', () => {
    expect(normalizeBdPhone('01835200626')).toBe('01835200626');
    expect(normalizeBdPhone('+880 1835-200626')).toBe('01835200626');
    expect(normalizeBdPhone('8801835200626')).toBe('01835200626');
  });
  it('rejects non-mobile numbers', () => {
    expect(normalizeBdPhone('0235200626')).toBeNull();
    expect(normalizeBdPhone('01235200626')).toBeNull();
    expect(normalizeBdPhone('abc')).toBeNull();
  });
});

describe('paymentReference', () => {
  it('strips spaces and symbols', () => {
    expect(paymentReference('Ahnaf Ahad')).toBe('AhnafAhad_bthibamock');
    expect(paymentReference("Ra'fi-uddin")).toBe('Rafiuddin_bthibamock');
  });
  it('falls back when the name has no latin letters', () => {
    expect(paymentReference('আহনাফ')).toBe('Student_bthibamock');
  });
});

describe('accessUntil', () => {
  it('is 30 days out', () => {
    const from = new Date('2026-11-01T00:00:00Z');
    expect(accessUntil(from).toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });
});

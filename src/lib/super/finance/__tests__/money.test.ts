import { describe, expect, it } from 'vitest';
import { bdtToPaisa, deriveStatus, feesDue, monthlyTotals, paidTotal, paisaToBdt, toCsv } from '../money';

const reg = { pricingFinalPrice: null, programMode: null, selectedMocks: null, selectedFullCourses: null };

describe('paisa/BDT conversion', () => {
  it('converts explicitly in both directions', () => {
    expect(paisaToBdt(12345)).toBe(123.45);
    expect(bdtToPaisa(123.45)).toBe(12345);
    expect(bdtToPaisa(paisaToBdt(19))).toBe(19);
  });
  it('monthlyTotals mixes whole-BDT payments with paisa entries correctly', () => {
    const rows = monthlyTotals(
      [{ amount: 7000, createdAtMs: Date.UTC(2026, 5, 15) }],
      [{ kind: 'income', date: '2026-06-02', amountMinor: 50000 }, { kind: 'expense', date: '2026-06-03', amountMinor: 12050 }],
    );
    expect(rows).toEqual([{ month: '2026-06', registrations: 7000, opIncome: 500, opExpense: 120.5, net: 7379.5 }]);
  });
});

describe('fees due / paid / status', () => {
  it('uses stored price, else recomputes mocks, else iba-combined', () => {
    expect(feesDue({ ...reg, pricingFinalPrice: 5700 })).toBe(5700);
    expect(feesDue({ ...reg, programMode: 'mocks', selectedMocks: '["du-iba","bup-iba"]' })).toBe(4940); // 5200 - 5%
    expect(feesDue({ ...reg, programMode: 'full', selectedFullCourses: '["iba-combined"]' })).toBe(17500);
    expect(feesDue(reg)).toBe(0);
  });
  it('ignores pending rows and nets refunds', () => {
    expect(paidTotal([{ amount: 3000, status: 'paid' }, { amount: 2000, status: 'pending' }, { amount: -500, status: 'refunded' }])).toBe(2500);
  });
  it('derives status', () => {
    expect(deriveStatus(5000, 0, false)).toBe('pending');
    expect(deriveStatus(5000, 2000, false)).toBe('partial');
    expect(deriveStatus(5000, 5000, false)).toBe('paid');
    expect(deriveStatus(5000, 0, true)).toBe('refunded');
    expect(deriveStatus(5000, 1000, true)).toBe('partial');
  });
});

describe('toCsv', () => {
  it('neutralises formulas in text but not numbers, and quotes specials', () => {
    expect(toCsv([['=HYPERLINK("x")', -500, 'a,b', '+1', null]])).toBe(`"'=HYPERLINK(""x"")",-500,"a,b",'+1,`);
  });
});

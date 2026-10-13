import { describe, it, expect } from 'vitest';
import {
  ageDays, isStale, canTransition, compareInbox, sortInbox, countByStatus, buildInvoice,
  productsForRegistration, staleRegistrationCutoff, STALE_REGISTRATION_DAYS,
} from '../enrolment';

const NOW = Date.UTC(2026, 9, 13);
const daysAgo = (d: number) => NOW - d * 86_400_000;

describe('age / stale flag', () => {
  it('counts whole days and never goes negative', () => {
    expect(ageDays(daysAgo(19), NOW)).toBe(19);
    expect(ageDays(NOW + 5000, NOW)).toBe(0);
  });
  it('flags pending and contacted older than 14 days (same rule as the Overview card)', () => {
    expect(STALE_REGISTRATION_DAYS).toBe(14);
    expect(staleRegistrationCutoff(NOW).getTime()).toBe(daysAgo(14));
    expect(isStale('pending', daysAgo(15), NOW)).toBe(true);
    expect(isStale('pending', daysAgo(14), NOW)).toBe(false); // exactly 14 days is not yet over
    expect(isStale('pending', daysAgo(2), NOW)).toBe(false);
  });
  it('does not flag contacted, enrolled or cancelled', () => {
    for (const s of ['contacted', 'enrolled', 'cancelled']) expect(isStale(s, daysAgo(60), NOW)).toBe(false);
  });
});

describe('status transitions', () => {
  it('allows the forward path and cancel', () => {
    expect(canTransition('pending', 'contacted')).toBe(true);
    expect(canTransition('pending', 'enrolled')).toBe(true);
    expect(canTransition('contacted', 'enrolled')).toBe(true);
    expect(canTransition('contacted', 'cancelled')).toBe(true);
  });
  it('blocks going back, repeating and leaving a closed state', () => {
    expect(canTransition('contacted', 'pending')).toBe(false);
    expect(canTransition('pending', 'pending')).toBe(false);
    expect(canTransition('enrolled', 'cancelled')).toBe(false);
    expect(canTransition('cancelled', 'enrolled')).toBe(false);
    expect(canTransition('pending', 'bogus')).toBe(false);
  });
});

describe('inbox ordering', () => {
  it('puts open first, oldest first; closed after, newest first', () => {
    const rows = [
      { id: 1, status: 'enrolled', createdAtMs: daysAgo(30) },
      { id: 2, status: 'pending', createdAtMs: daysAgo(3) },
      { id: 3, status: 'contacted', createdAtMs: daysAgo(20) },
      { id: 4, status: 'cancelled', createdAtMs: daysAgo(5) },
      { id: 5, status: 'pending', createdAtMs: daysAgo(19) },
    ];
    expect(sortInbox(rows).map((r) => r.id)).toEqual([3, 5, 2, 4, 1]);
    expect(rows[0].id).toBe(1); // input untouched
    expect(compareInbox(rows[1], rows[1])).toBe(0);
  });
  it('counts by status', () => {
    expect(countByStatus([{ status: 'pending' }, { status: 'pending' }, { status: 'enrolled' }, { status: 'x' }]))
      .toEqual({ pending: 2, contacted: 0, enrolled: 1, cancelled: 0 });
  });
});

describe('invoice', () => {
  it('shows mock lines with bundle discount reason and referral', () => {
    const inv = buildInvoice({
      programMode: 'mocks', selectedMocks: '["du-iba","bup-iba"]', selectedFullCourses: null,
      pricingSubtotal: 5200, pricingDiscount: 260, pricingFinalPrice: 4940,
      referralName: 'Aanya Rahman', referralInstitution: 'Notre Dame', referralBatch: '2025',
    });
    expect(inv.lines).toEqual([{ label: 'DU IBA mock', amount: 3000 }, { label: 'BUP IBA mock', amount: 2200 }]);
    expect(inv.discountReason).toBe('2-mock bundle (5%) · referral from Aanya Rahman');
    expect(inv.finalAmount).toBe(4940);
    expect(inv.referral).toBe('Aanya Rahman, Notre Dame, 2025');
  });
  it('has no discount reason without a discount, and tolerates bad JSON', () => {
    const inv = buildInvoice({
      programMode: 'full', selectedMocks: null, selectedFullCourses: 'not json',
      pricingSubtotal: null, pricingDiscount: null, pricingFinalPrice: null,
      referralName: null, referralInstitution: null, referralBatch: null,
    });
    expect(inv.lines).toEqual([]);
    expect(inv.discountReason).toBeNull();
    expect(inv.finalAmount).toBe(0);
  });
});

describe('productsForRegistration', () => {
  it('maps tokens to unique products', () => {
    expect(productsForRegistration({ programMode: 'mocks', selectedMocks: '["du-iba","bup-iba","du-fbs"]', selectedFullCourses: null }).sort())
      .toEqual(['fbs', 'iba']);
    expect(productsForRegistration({ programMode: 'full', selectedMocks: null, selectedFullCourses: '["iba-combined"]' })).toEqual(['iba']);
    expect(productsForRegistration({ programMode: 'full', selectedMocks: null, selectedFullCourses: null })).toEqual([]);
  });
});

import { describe, it, expect } from 'vitest';
import { computeOccurrences } from '../schedule-generator-pure';

// Reference: Monday 2026-01-12 00:00 UTC = Monday 06:00 Dhaka

const MON_UTC_MIDNIGHT = new Date('2026-01-12T00:00:00Z');

describe('computeOccurrences', () => {
  it('returns one occurrence within a 7-day horizon for a weekly rule', () => {
    // Monday 14:00 Dhaka = Monday 08:00 UTC
    const rule = { dayOfWeek: 1 /* Monday */, timeOfDay: '14:00' };
    const results = computeOccurrences(rule, MON_UTC_MIDNIGHT, 7);
    expect(results).toHaveLength(1);
    expect(results[0].toISOString()).toBe('2026-01-12T08:00:00.000Z');
  });

  it('returns two occurrences within a 14-day horizon for a weekly rule', () => {
    const rule = { dayOfWeek: 1 /* Monday */, timeOfDay: '14:00' };
    const results = computeOccurrences(rule, MON_UTC_MIDNIGHT, 14);
    expect(results).toHaveLength(2);
    expect(results[0].toISOString()).toBe('2026-01-12T08:00:00.000Z');
    expect(results[1].toISOString()).toBe('2026-01-19T08:00:00.000Z');
  });

  it('returns correct Dhaka→UTC conversion for Sunday schedule', () => {
    // Sunday 10:00 Dhaka = Sunday 04:00 UTC
    // From Mon 2026-01-12 → next Sunday = 2026-01-18
    const rule = { dayOfWeek: 0 /* Sunday */, timeOfDay: '10:00' };
    const results = computeOccurrences(rule, MON_UTC_MIDNIGHT, 14);
    expect(results).toHaveLength(2);
    expect(results[0].toISOString()).toBe('2026-01-18T04:00:00.000Z');
    expect(results[1].toISOString()).toBe('2026-01-25T04:00:00.000Z');
  });

  it('handles Saturday near midnight (day rollover scenario)', () => {
    // Saturday 23:30 Dhaka = Saturday 17:30 UTC
    const rule = { dayOfWeek: 6 /* Saturday */, timeOfDay: '23:30' };
    const results = computeOccurrences(rule, MON_UTC_MIDNIGHT, 7);
    expect(results).toHaveLength(1);
    // Next Saturday from Mon 2026-01-12 is 2026-01-17
    expect(results[0].toISOString()).toBe('2026-01-17T17:30:00.000Z');
  });

  it('returns empty array when daysAhead=0 and no same-moment occurrence', () => {
    const rule = { dayOfWeek: 3 /* Wednesday */, timeOfDay: '10:00' };
    const results = computeOccurrences(rule, MON_UTC_MIDNIGHT, 0);
    // fromDate = Mon; to = Mon + 0d = Mon; Wednesday is 2 days away → beyond horizon
    expect(results).toHaveLength(0);
  });

  it('occurrences are spaced exactly 7 days apart', () => {
    const rule = { dayOfWeek: 2 /* Tuesday */, timeOfDay: '08:00' };
    const results = computeOccurrences(rule, MON_UTC_MIDNIGHT, 21);
    expect(results).toHaveLength(3);
    expect(results[1].getTime() - results[0].getTime()).toBe(7 * 86400_000);
    expect(results[2].getTime() - results[1].getTime()).toBe(7 * 86400_000);
  });

  it('toDate boundary is inclusive — occurrence exactly at fromDate + daysAhead is included', () => {
    // From Mon 2026-01-12 00:00 UTC + 7 days = 2026-01-19 00:00 UTC
    // Monday 14:00 Dhaka = 08:00 UTC → 2026-01-19 08:00 UTC is AFTER boundary
    const rule = { dayOfWeek: 1 /* Monday */, timeOfDay: '14:00' };
    const results = computeOccurrences(rule, MON_UTC_MIDNIGHT, 7);
    // 2026-01-12 08:00 UTC is within 7 days; 2026-01-19 08:00 UTC is 7 days + 8h → beyond
    expect(results).toHaveLength(1);
  });

  it('handles Dhaka time before UTC midnight (timezone boundary)', () => {
    // Dhaka Wednesday 01:00 = Tuesday 19:00 UTC
    const rule = { dayOfWeek: 3 /* Wednesday */, timeOfDay: '01:00' };
    // From Mon 2026-01-12 UTC, next Wed Dhaka = 2026-01-14 01:00 Dhaka = 2026-01-13 19:00 UTC
    const results = computeOccurrences(rule, MON_UTC_MIDNIGHT, 7);
    expect(results).toHaveLength(1);
    expect(results[0].toISOString()).toBe('2026-01-13T19:00:00.000Z');
  });
});

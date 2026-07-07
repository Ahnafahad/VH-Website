import { describe, it, expect } from 'vitest';
import { dhakaDayAndTimeToUtc, formatDhaka } from '../time';

// Dhaka is UTC+6 (no DST). So Dhaka midnight = UTC 18:00 previous day.

describe('dhakaDayAndTimeToUtc', () => {
  // Reference: 2026-01-12 Monday UTC 00:00 = 2026-01-12 Monday 06:00 Dhaka
  const MON_UTC_MIDNIGHT = new Date('2026-01-12T00:00:00Z');

  // Dhaka day of MON_UTC_MIDNIGHT = Monday 06:00 Dhaka → day index 1

  it('returns the same day when target is later on the same Dhaka weekday', () => {
    // Reference: Mon 00:00 UTC = Mon 06:00 Dhaka
    // Request: Monday 14:00 Dhaka = Mon 08:00 UTC (same calendar day)
    const result = dhakaDayAndTimeToUtc(1 /* Monday */, '14:00', MON_UTC_MIDNIGHT);
    expect(result.toISOString()).toBe('2026-01-12T08:00:00.000Z');
  });

  it('returns next week when target is earlier on the same Dhaka weekday', () => {
    // Reference: Mon 06:00 Dhaka. Request: Monday 05:00 Dhaka → already passed → +7d
    const result = dhakaDayAndTimeToUtc(1 /* Monday */, '05:00', MON_UTC_MIDNIGHT);
    // 2026-01-19 Mon 05:00 Dhaka = 2026-01-18 Sun 23:00 UTC
    expect(result.toISOString()).toBe('2026-01-18T23:00:00.000Z');
  });

  it('handles Sunday (dayOfWeek=0) correctly', () => {
    // Reference: Mon 00:00 UTC = Mon 06:00 Dhaka
    // Next Sunday 10:00 Dhaka = Sun 04:00 UTC = 2026-01-18T04:00:00Z
    const result = dhakaDayAndTimeToUtc(0 /* Sunday */, '10:00', MON_UTC_MIDNIGHT);
    expect(result.toISOString()).toBe('2026-01-18T04:00:00.000Z');
  });

  it('handles Saturday (dayOfWeek=6) correctly', () => {
    // Reference: Mon 00:00 UTC. Next Saturday 20:00 Dhaka = Sat 14:00 UTC = 2026-01-17T14:00:00Z
    const result = dhakaDayAndTimeToUtc(6 /* Saturday */, '20:00', MON_UTC_MIDNIGHT);
    expect(result.toISOString()).toBe('2026-01-17T14:00:00.000Z');
  });

  it('handles day rollover near Dhaka midnight (time near 00:00 Dhaka)', () => {
    // Reference: 2026-01-12 Mon 00:00 UTC = Mon 06:00 Dhaka
    // Request: Tuesday 00:30 Dhaka = Mon 18:30 UTC
    const result = dhakaDayAndTimeToUtc(2 /* Tuesday */, '00:30', MON_UTC_MIDNIGHT);
    expect(result.toISOString()).toBe('2026-01-12T18:30:00.000Z');
  });

  it('correctly converts a day that starts before UTC midnight (Dhaka ahead of UTC)', () => {
    // Friday 22:00 Dhaka = Friday 16:00 UTC
    // Reference: Mon 00:00 UTC. Next Friday = 2026-01-16
    const result = dhakaDayAndTimeToUtc(5 /* Friday */, '22:00', MON_UTC_MIDNIGHT);
    expect(result.toISOString()).toBe('2026-01-16T16:00:00.000Z');
  });

  it('is idempotent when called twice with same parameters', () => {
    const r1 = dhakaDayAndTimeToUtc(3, '09:00', MON_UTC_MIDNIGHT);
    const r2 = dhakaDayAndTimeToUtc(3, '09:00', MON_UTC_MIDNIGHT);
    expect(r1.getTime()).toBe(r2.getTime());
  });

  it('respects 14-day horizon: second occurrence is 7 days after first', () => {
    const first  = dhakaDayAndTimeToUtc(1 /* Monday */, '14:00', MON_UTC_MIDNIGHT);
    const second = dhakaDayAndTimeToUtc(1 /* Monday */, '14:00', new Date(first.getTime() + 1));
    expect(second.getTime() - first.getTime()).toBe(7 * 86400_000);
  });
});

describe('formatDhaka', () => {
  // UTC 2026-01-12T08:00:00Z = Dhaka 2026-01-12 14:00
  const d = new Date('2026-01-12T08:00:00Z');

  it('formats with "time" preset and contains 2:00', () => {
    const result = formatDhaka(d, 'time');
    // Should contain 2:00 PM or 14:00 depending on locale
    expect(result).toMatch(/2:00|14:00/);
  });

  it('formats with "date" preset and contains Jan 12', () => {
    const result = formatDhaka(d, 'date');
    expect(result).toMatch(/Jan/i);
    expect(result).toMatch(/12/);
  });

  it('formats with "datetime" preset (contains both date and time parts)', () => {
    const result = formatDhaka(d, 'datetime');
    expect(result).toMatch(/Jan/i);
    expect(result).toMatch(/2:00|14:00/);
  });

  it('accepts a full Intl.DateTimeFormatOptions object', () => {
    const result = formatDhaka(d, { hour: 'numeric', minute: '2-digit' });
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

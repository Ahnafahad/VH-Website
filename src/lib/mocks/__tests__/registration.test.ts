import { describe, expect, it } from 'vitest';
import { accessUntil, formatSlotTime, MOCK_SCHEDULE, nextMock, normalizeBdPhone, paymentReference, slotDay } from '../registration-pure';

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

describe('mock schedule', () => {
  it('has ten mocks in date order, each on the weekday the routine states', () => {
    expect(MOCK_SCHEDULE).toHaveLength(10);
    const dates = MOCK_SCHEDULE.map(s => s.date);
    expect([...dates].sort()).toEqual(dates);
    expect(slotDay('2026-11-02').weekday).toBe('Monday');
    expect(slotDay('2026-11-05').weekday).toBe('Thursday');
    expect(slotDay('2026-11-21').weekday).toBe('Saturday');
    expect(slotDay('2026-11-28').weekday).toBe('Saturday');
  });
  it('formats times like the routine', () => {
    expect(formatSlotTime('14:00-16:00')).toBe('2:00 – 4:00 PM');
    expect(formatSlotTime('11:30-13:30')).toBe('11:30 AM – 1:30 PM');
    expect(formatSlotTime('09:00-11:00')).toBe('9:00 – 11:00 AM');
  });
  it('picks the next mock by Dhaka time', () => {
    expect(nextMock(new Date('2026-10-31T00:00:00Z'))?.n).toBe(1);
    expect(nextMock(new Date('2026-11-02T09:00:00Z'))?.n).toBe(1);   // 15:00 Dhaka, mock 1 still running
    expect(nextMock(new Date('2026-11-02T10:30:00Z'))?.n).toBe(2);   // 16:30 Dhaka, mock 1 is over
    expect(nextMock(new Date('2026-12-01T00:00:00Z'))).toBeNull();
  });
});

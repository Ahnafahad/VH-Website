import { describe, expect, it } from 'vitest';
import { dhakaWeekStart } from '../dhaka-time';

describe('dhakaWeekStart', () => {
  it('returns Monday midnight in Dhaka as UTC', () => {
    expect(dhakaWeekStart(new Date('2026-07-12T12:00:00.000Z')).toISOString()).toBe('2026-07-05T18:00:00.000Z');
  });

  it('stays on the same week during Monday in Dhaka', () => {
    expect(dhakaWeekStart(new Date('2026-07-06T03:00:00.000Z')).toISOString()).toBe('2026-07-05T18:00:00.000Z');
  });
});

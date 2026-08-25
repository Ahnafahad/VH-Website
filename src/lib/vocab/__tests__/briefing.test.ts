import { describe, expect, it } from 'vitest';
import { computeRequiredPace, sortByBriefingPriority } from '../briefing';

describe('sortByBriefingPriority', () => {
  it('always puts resume first regardless of input order', () => {
    const sorted = sortByBriefingPriority([
      { kind: 'fresh' as const, id: 1 },
      { kind: 'deadline_file' as const, id: 2 },
      { kind: 'resume' as const, id: 3 },
      { kind: 'repeat_offenders' as const, id: 4 },
    ]);
    expect(sorted.map(c => c.kind)).toEqual(['resume', 'repeat_offenders', 'deadline_file', 'fresh']);
  });

  it('is stable and does not mutate the input array', () => {
    const input = [{ kind: 'fresh' as const }, { kind: 'repeat_offenders' as const }];
    const sorted = sortByBriefingPriority(input);
    expect(input.map(c => c.kind)).toEqual(['fresh', 'repeat_offenders']);
    expect(sorted.map(c => c.kind)).toEqual(['repeat_offenders', 'fresh']);
  });
});

describe('computeRequiredPace', () => {
  it('returns nulls when no deadline is set', () => {
    expect(computeRequiredPace(null, 100)).toEqual({ requiredPace: null, daysUntilDeadline: null });
  });

  it('returns nulls when the deadline has already passed', () => {
    const past = new Date(Date.now() - 86_400_000);
    expect(computeRequiredPace(past, 100)).toEqual({ requiredPace: null, daysUntilDeadline: null });
  });

  it('computes a minimum pace of 1 even with few words remaining', () => {
    const future = new Date(Date.now() + 30 * 86_400_000);
    expect(computeRequiredPace(future, 2).requiredPace).toBe(1);
  });

  it('ceils the pace so partial days round up', () => {
    const future = new Date(Date.now() + 10 * 86_400_000 + 1000); // just over 10 days
    const { requiredPace, daysUntilDeadline } = computeRequiredPace(future, 95);
    expect(daysUntilDeadline).toBe(11);
    expect(requiredPace).toBe(Math.ceil(95 / 11));
  });
});

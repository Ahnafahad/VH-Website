import { describe, it, expect } from 'vitest';
import { calculatePoints, questionTimeLimit } from '../scoring';

describe('calculatePoints', () => {
  const basic = {
    isCorrect:      true,
    isSkip:         false,
    operation:      'addition' as const,
    difficulty:     1.0,
    overageSeconds: 0,
    multiOp:        false,
    avgResponseMs:  6000,
  };

  it('awards positive points for correct', () => {
    const pts = calculatePoints(basic);
    expect(pts).toBeGreaterThan(0);
  });

  it('deducts on wrong', () => {
    const pts = calculatePoints({ ...basic, isCorrect: false });
    expect(pts).toBeLessThan(0);
  });

  it('deducts smaller on skip than wrong (skip 30% vs wrong 50% of base)', () => {
    const skip  = calculatePoints({ ...basic, isSkip: true, isCorrect: false });
    const wrong = calculatePoints({ ...basic, isCorrect: false });
    expect(Math.abs(skip)).toBeLessThan(Math.abs(wrong));
  });

  it('applies multi-op bonus 1.3× to correct', () => {
    const single = calculatePoints(basic);
    const multi  = calculatePoints({ ...basic, multiOp: true });
    expect(multi).toBeGreaterThan(single);
  });

  it('applies speed bonus when avgResponseMs is low', () => {
    const slow = calculatePoints({ ...basic, avgResponseMs: 8000 });
    const fast = calculatePoints({ ...basic, avgResponseMs: 2000 });
    expect(fast).toBeGreaterThan(slow);
  });

  it('overage penalty decays monotonically', () => {
    const none  = calculatePoints({ ...basic, overageSeconds: 0 });
    const small = calculatePoints({ ...basic, overageSeconds: 2 });
    const big   = calculatePoints({ ...basic, overageSeconds: 10 });
    expect(none).toBeGreaterThanOrEqual(small);
    expect(small).toBeGreaterThanOrEqual(big);
    expect(big).toBeGreaterThan(0); // clamped at 0.1×
  });

  it('harder difficulty awards more base points', () => {
    const easy    = calculatePoints({ ...basic, difficulty: 1.0 });
    const extreme = calculatePoints({ ...basic, difficulty: 4.5 });
    expect(extreme).toBeGreaterThan(easy);
  });

  it('division rewards more than addition at same tier', () => {
    const add = calculatePoints({ ...basic, operation: 'addition' });
    const div = calculatePoints({ ...basic, operation: 'division' });
    expect(div).toBeGreaterThan(add);
  });
});

describe('questionTimeLimit', () => {
  it('adds time penalty', () => {
    const base    = questionTimeLimit('addition', 1.0, 0);
    const penalty = questionTimeLimit('addition', 1.0, 60);
    expect(penalty - base).toBe(60);
  });

  it('harder tier has longer allotment', () => {
    const easy    = questionTimeLimit('multiplication', 1.0);
    const extreme = questionTimeLimit('multiplication', 4.5);
    expect(extreme).toBeGreaterThan(easy);
  });
});

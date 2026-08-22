import { describe, it, expect } from 'vitest';
import { median, isSlow, SLOW_MULTIPLIER, MIN_SAMPLES } from '../time-flags';

describe('median', () => {
  it('returns 0 for an empty list', () => {
    expect(median([])).toBe(0);
  });
  it('averages the two middle values for an even-length list', () => {
    expect(median([10, 20, 30, 40])).toBe(25);
  });
  it('picks the middle value for an odd-length list', () => {
    expect(median([5, 1, 9])).toBe(5);
  });
});

describe('isSlow', () => {
  it('never flags when the sample is smaller than MIN_SAMPLES', () => {
    const others = Array(MIN_SAMPLES - 1).fill(10_000);
    expect(isSlow(1_000_000, others)).toBe(false);
  });

  it('flags a time more than the multiplier over the class median once enough samples exist', () => {
    const others = Array(MIN_SAMPLES).fill(10_000); // median 10s
    expect(isSlow(10_000 * SLOW_MULTIPLIER + 1, others)).toBe(true);
    expect(isSlow(10_000 * SLOW_MULTIPLIER, others)).toBe(false); // exactly at the line is not "more than"
  });

  it('never flags when the class median is 0 (no timing data)', () => {
    const others = Array(MIN_SAMPLES).fill(0);
    expect(isSlow(5_000, others)).toBe(false);
  });

  it('respects custom multiplier/minSamples overrides', () => {
    const others = [100, 100, 100];
    expect(isSlow(150, others, { multiplier: 1.2, minSamples: 3 })).toBe(true);
    expect(isSlow(150, others, { multiplier: 1.2, minSamples: 4 })).toBe(false); // sample too small now
  });
});

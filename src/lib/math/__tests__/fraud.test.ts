import { describe, it, expect } from 'vitest';
import { detectSuspicious } from '../fraud';

describe('detectSuspicious', () => {
  it('flags sub-2s responses regardless of expected', () => {
    expect(detectSuspicious({
      responseTimeSec: 1.2,
      allocatedSeconds: 20,
      recentTimesSec: [],
    })).toBe(true);
  });

  it('flags under 10% of expected', () => {
    expect(detectSuspicious({
      responseTimeSec: 2.1,   // above 2s floor
      allocatedSeconds: 30,   // 10% = 3s → still flagged because 2.1 < 3
      recentTimesSec: [],
    })).toBe(true);
  });

  it('does not flag realistic-fast answers', () => {
    expect(detectSuspicious({
      responseTimeSec: 5,
      allocatedSeconds: 10,
      recentTimesSec: [],
    })).toBe(false);
  });

  it('flags consistently-fast low-variance streaks under 30% expected', () => {
    expect(detectSuspicious({
      responseTimeSec: 2.9,
      allocatedSeconds: 10,
      recentTimesSec: [2.8, 2.9, 2.85],  // variance < 0.5, all ~30%
    })).toBe(true);
  });

  it('does not flag when variance is high', () => {
    expect(detectSuspicious({
      responseTimeSec: 2.5,
      allocatedSeconds: 10,
      recentTimesSec: [1.5, 4.0, 7.5], // high variance
    })).toBe(false);
  });
});

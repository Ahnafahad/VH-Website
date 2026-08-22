/**
 * Pure "spent too long" flagging for the Math Marathon module. No DB access
 * here — everything is unit-testable.
 *
 * Method (confirmed with the user): self-calibrating, relative to the class —
 * a question (or a whole day) is flagged slow when the student's time is more
 * than SLOW_MULTIPLIER × the median time other students spent on it, and only
 * once at least MIN_SAMPLES other timings exist (so the very first few
 * students through a fresh day never get spuriously flagged off a tiny
 * sample).
 */

export const SLOW_MULTIPLIER = 2;
export const MIN_SAMPLES = 5;

export function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface SlowCheckOptions {
  multiplier?: number;
  minSamples?: number;
}

/**
 * `otherTimesMs` should be the timings of everyone ELSE who has submitted
 * (excluding the student being checked) so a single outlier can't inflate
 * its own comparison baseline.
 */
export function isSlow(myTimeMs: number, otherTimesMs: number[], opts: SlowCheckOptions = {}): boolean {
  const multiplier = opts.multiplier ?? SLOW_MULTIPLIER;
  const minSamples = opts.minSamples ?? MIN_SAMPLES;
  if (otherTimesMs.length < minSamples) return false;
  const med = median(otherTimesMs);
  if (med <= 0) return false;
  return myTimeMs > med * multiplier;
}

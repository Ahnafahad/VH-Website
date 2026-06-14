import {
  FRAUD_FAST_FRACTION,
  FRAUD_MIN_FRACTION,
  FRAUD_MIN_RESPONSE_SEC,
  FRAUD_VARIANCE_THRESHOLD,
} from './constants';

export interface FraudInput {
  responseTimeSec:   number;
  allocatedSeconds:  number;
  recentTimesSec:    number[];   // last N response times
}

/**
 * Flag an attempt as suspicious if it resembles machine/calculator answering.
 * Heuristic port of legacy in-file `detectCalc`.
 */
export function detectSuspicious(input: FraudInput): boolean {
  const { responseTimeSec: rt, allocatedSeconds: expected, recentTimesSec } = input;

  // Absolute too-fast floor
  const minHuman = Math.max(FRAUD_MIN_RESPONSE_SEC, expected * FRAUD_MIN_FRACTION);
  if (rt < minHuman) return true;

  // Sub-pattern: consistent sub-30%-expected answers with low variance
  if (recentTimesSec.length >= 3) {
    const recent = recentTimesSec.slice(-3);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((acc, t) => acc + (t - avg) ** 2, 0) / recent.length;
    if (variance < FRAUD_VARIANCE_THRESHOLD && rt < expected * FRAUD_FAST_FRACTION) return true;
  }
  return false;
}

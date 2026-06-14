import type { MathOperation } from '@/lib/db/schema';
import {
  BASE_POINTS,
  DIFFICULTY_MULT,
  MULTI_OP_BONUS,
  OPERATION_MULT,
  Q_TIME_LIMITS,
  bucketDifficulty,
} from './constants';

export interface ScoreInput {
  isCorrect:      boolean;
  isSkip:         boolean;
  operation:      MathOperation;
  difficulty:     number;       // continuous 1.0–5.0
  overageSeconds: number;       // 0 = within budget
  multiOp:        boolean;
  avgResponseMs:  number;       // running avg of response times for speed bonus
}

/**
 * Points awarded for a single attempt. Pure — same inputs always yield same output.
 * Ports the legacy `calcPoints` in-file helper into a testable module.
 */
export function calculatePoints(input: ScoreInput): number {
  const tier = bucketDifficulty(input.difficulty);
  const base = BASE_POINTS[tier];

  if (input.isSkip) return -Math.floor(base * 0.3);
  if (!input.isCorrect) return -Math.floor(base * 0.5);

  let pts = base * DIFFICULTY_MULT[tier] * OPERATION_MULT[input.operation];
  if (input.multiOp) pts *= MULTI_OP_BONUS;

  if (input.overageSeconds <= 0) {
    if (input.avgResponseMs < 3000) pts *= 1.5;
    else if (input.avgResponseMs < 5000) pts *= 1.2;
  } else {
    const allocated = Q_TIME_LIMITS[input.operation][tier];
    const rate = Math.max(0.1, 1 / Math.sqrt(allocated));
    pts *= Math.max(0.1, Math.pow(0.5, input.overageSeconds * rate));
  }
  return Math.floor(pts);
}

export function questionTimeLimit(
  op: MathOperation,
  difficulty: number,
  timePenalty = 0,
): number {
  const tier = bucketDifficulty(difficulty);
  return Q_TIME_LIMITS[op][tier] + timePenalty;
}

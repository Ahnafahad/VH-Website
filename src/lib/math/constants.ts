import type { MathOperation } from '@/lib/db/schema';

export type Tier = 'easy' | 'medium' | 'hard' | 'extreme';

export const OPERATIONS: readonly MathOperation[] = [
  'addition',
  'subtraction',
  'multiplication',
  'division',
] as const;

export const OP_SYMBOL: Record<MathOperation, string> = {
  addition:       '+',
  subtraction:    '−',
  multiplication: '×',
  division:       '÷',
};

export const OP_LABELS: Record<MathOperation, string> = {
  addition:       'Addition (+)',
  subtraction:    'Subtraction (−)',
  multiplication: 'Multiplication (×)',
  division:       'Division (÷)',
};

export const TIER_LIST: readonly Tier[] = ['easy', 'medium', 'hard', 'extreme'] as const;

export const TIER_LABEL: Record<Tier, string> = {
  easy:    'Easy',
  medium:  'Medium',
  hard:    'Hard',
  extreme: 'Extreme',
};

export const TIME_OPTIONS: readonly { value: number; label: string }[] = [
  { value: 0.5, label: '30 seconds' },
  { value: 1,   label: '1 minute' },
  { value: 1.5, label: '1.5 minutes' },
  { value: 2,   label: '2 minutes' },
  { value: 3,   label: '3 minutes' },
  { value: 5,   label: '5 minutes' },
] as const;

export const BASE_POINTS: Record<Tier, number> = {
  easy: 10, medium: 15, hard: 25, extreme: 40,
};

export const DIFFICULTY_MULT: Record<Tier, number> = {
  easy: 1, medium: 1.5, hard: 2, extreme: 3,
};

export const OPERATION_MULT: Record<MathOperation, number> = {
  addition: 1, subtraction: 1.2, multiplication: 1.5, division: 1.8,
};

export const MULTI_OP_BONUS = 1.3;

export const Q_TIME_LIMITS: Record<MathOperation, Record<Tier, number>> = {
  addition:       { easy: 5,  medium: 8,  hard: 12, extreme: 18 },
  subtraction:    { easy: 6,  medium: 10, hard: 15, extreme: 20 },
  multiplication: { easy: 8,  medium: 12, hard: 20, extreme: 25 },
  division:       { easy: 10, medium: 15, hard: 25, extreme: 30 },
};

export const SKIPS_FREE = 3;
export const SKIP_PENALTY_SECONDS = 60;

// Adaptive
export const ADAPTIVE_TARGET_ACCURACY = 0.75;
export const ADAPTIVE_SKILL_MIN = 1.0;
export const ADAPTIVE_SKILL_MAX = 5.0;
export const ADAPTIVE_INITIAL_SKILL = 2.5;
export const ADAPTIVE_LEARNING_RATE = 0.12;
export const ADAPTIVE_SLOPE = 1.2;            // Elo curve slope
export const ADAPTIVE_TARGET_OFFSET = 0.55;   // diff = skill - offset → ~75% win
export const ADAPTIVE_JITTER = 0.25;          // ± range for next-question diff
export const ADAPTIVE_SUSPICIOUS_WEIGHT = 0.2;
export const ADAPTIVE_SKIP_WEIGHT = 0.5;

// Fraud detection
export const FRAUD_MIN_RESPONSE_SEC = 2;
export const FRAUD_MIN_FRACTION = 0.1;        // < 10% expected → suspicious
export const FRAUD_VARIANCE_THRESHOLD = 0.5;
export const FRAUD_FAST_FRACTION = 0.3;       // < 30% expected with low variance → suspicious

// Bucket thresholds for continuous difficulty (1.0–5.0) → tier
export function bucketDifficulty(d: number): Tier {
  if (d < 1.5) return 'easy';
  if (d < 2.5) return 'medium';
  if (d < 3.5) return 'hard';
  return 'extreme';
}

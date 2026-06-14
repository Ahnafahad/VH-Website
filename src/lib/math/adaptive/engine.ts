import type { MathOperation } from '@/lib/db/schema';
import {
  ADAPTIVE_JITTER,
  ADAPTIVE_LEARNING_RATE,
  ADAPTIVE_SKILL_MAX,
  ADAPTIVE_SKILL_MIN,
  ADAPTIVE_SKIP_WEIGHT,
  ADAPTIVE_SLOPE,
  ADAPTIVE_SUSPICIOUS_WEIGHT,
  ADAPTIVE_TARGET_OFFSET,
} from '../constants';
import {
  appendSignal,
  weakestOperation,
  type AdaptiveState,
  type AttemptSignal,
} from './state';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Elo-style P(correct) on a 1–5 skill/diff scale. Slope tuned so Δ=0.5 ≈ 70%. */
export function expectedWin(skill: number, diff: number): number {
  return 1 / (1 + Math.pow(10, (diff - skill) / ADAPTIVE_SLOPE));
}

export interface ApplyOptions {
  expectedTimeMs?: number;  // allocated time for the question
}

/**
 * Update state after an attempt.
 * - Correct: nudge skill up; Wrong: nudge down.
 * - Suspicious attempts: heavy discount.
 * - Skipped: soft signal.
 * - Time factor amplifies fast correct and slow wrong answers.
 */
export function applyAttempt(
  state: AdaptiveState,
  signal: AttemptSignal,
  opts: ApplyOptions = {},
): AdaptiveState {
  const currentSkill = state.skill[signal.operation];
  const actual = signal.isCorrect ? 1 : 0;
  const expected = expectedWin(currentSkill, signal.difficulty);

  let weight = 1;
  if (signal.wasSuspicious) weight *= ADAPTIVE_SUSPICIOUS_WEIGHT;
  if (signal.wasSkipped)    weight *= ADAPTIVE_SKIP_WEIGHT;

  const expectedMs = opts.expectedTimeMs ?? Math.max(1, signal.responseTimeMs);
  const timeFactor = clamp(expectedMs / Math.max(1, signal.responseTimeMs), 0.5, 1.5);

  const delta = ADAPTIVE_LEARNING_RATE * weight * timeFactor * (actual - expected);
  const newSkill = clamp(currentSkill + delta, ADAPTIVE_SKILL_MIN, ADAPTIVE_SKILL_MAX);

  const nextState = appendSignal(state, signal);
  return {
    ...nextState,
    skill: { ...state.skill, [signal.operation]: newSkill },
  };
}

export interface NextQuestionPlan {
  operation:  MathOperation;
  difficulty: number;
}

/**
 * Choose next (operation, difficulty) to target ~75% expected-win accuracy.
 * Operation rotates toward the weakest recent area.
 */
export function chooseNextQuestion(
  state: AdaptiveState,
  selectedOps: MathOperation[],
  rng: () => number = Math.random,
): NextQuestionPlan {
  const operation = weakestOperation(state, selectedOps);
  const target = state.skill[operation] - ADAPTIVE_TARGET_OFFSET;
  const jitter = (rng() * 2 - 1) * ADAPTIVE_JITTER;
  const difficulty = clamp(target + jitter, ADAPTIVE_SKILL_MIN, ADAPTIVE_SKILL_MAX);
  return { operation, difficulty };
}

/** Detect integer threshold crossings (2→3, etc.) between two states for level-up toast. */
export function skillLevelCrossings(
  prev: AdaptiveState,
  next: AdaptiveState,
): Array<{ operation: MathOperation; from: number; to: number }> {
  const crossings: Array<{ operation: MathOperation; from: number; to: number }> = [];
  (Object.keys(next.skill) as MathOperation[]).forEach((op) => {
    const a = prev.skill[op];
    const b = next.skill[op];
    const fa = Math.floor(a);
    const fb = Math.floor(b);
    if (fb > fa) crossings.push({ operation: op, from: fa, to: fb });
  });
  return crossings;
}

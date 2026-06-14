import type { MathOperation, MathUserProgress } from '@/lib/db/schema';
import { ADAPTIVE_INITIAL_SKILL, OPERATIONS, bucketDifficulty, Q_TIME_LIMITS } from './constants';
import type { AdaptiveState, SkillByOp } from './adaptive/state';
import { createInitialState } from './adaptive/state';
import { chooseNextQuestion, expectedWin } from './adaptive/engine';
import { generateQuestion, pickNextOperation, type Question } from './problem-gen';
import type { LegacyTier } from '@/components/math/types';

/** Pull SkillByOp out of a mathUserProgress row, falling back to init. */
export function skillFromProgress(progress: Pick<
  MathUserProgress,
  'skillAddition' | 'skillSubtraction' | 'skillMultiplication' | 'skillDivision'
> | null | undefined): SkillByOp {
  if (!progress) {
    const skill = {} as SkillByOp;
    for (const op of OPERATIONS) skill[op] = ADAPTIVE_INITIAL_SKILL;
    return skill;
  }
  return {
    addition:       progress.skillAddition,
    subtraction:    progress.skillSubtraction,
    multiplication: progress.skillMultiplication,
    division:       progress.skillDivision,
  };
}

export function buildAdaptiveState(progress: Parameters<typeof skillFromProgress>[0]): AdaptiveState {
  return createInitialState(skillFromProgress(progress));
}

/** Map a LegacyTier to continuous difficulty float. */
export const TIER_TO_DIFF: Record<LegacyTier, number> = {
  easy: 1.0, medium: 2.0, hard: 3.0, extreme: 4.5,
};

export function resolveDifficulty(value: number | LegacyTier): number {
  if (typeof value === 'number') return value;
  return TIER_TO_DIFF[value];
}

export interface ResolvedQuestion {
  operation:  MathOperation;
  difficulty: number;
  question:   Question;
  allocatedSeconds: number;
}

/** Pick the next (op, difficulty) and emit a question. Fixed mode uses tier; adaptive mode uses engine. */
export function nextResolved(
  opts: {
    adaptive:     boolean;
    selectedOps:  MathOperation[];
    state:        AdaptiveState;
    difficulty:   number;            // used when !adaptive
    prevQuestions: Question[];
    timePenalty?: number;
  },
): ResolvedQuestion {
  const { adaptive, selectedOps, state, difficulty, prevQuestions, timePenalty = 0 } = opts;
  let op: MathOperation;
  let diff: number;
  if (adaptive) {
    const plan = chooseNextQuestion(state, selectedOps);
    op = plan.operation;
    diff = plan.difficulty;
  } else {
    op = pickNextOperation(selectedOps);
    diff = difficulty;
  }
  const question = generateQuestion(op, diff, prevQuestions);
  const tier = bucketDifficulty(diff);
  const base = Q_TIME_LIMITS[op][tier];
  const allocatedSeconds = base + timePenalty;
  return { operation: op, difficulty: diff, question, allocatedSeconds };
}

/** Expose the engine's expected-win function on the server side for telemetry/debug. */
export { expectedWin };

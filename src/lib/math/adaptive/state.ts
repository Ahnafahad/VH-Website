import type { MathOperation } from '@/lib/db/schema';
import { ADAPTIVE_INITIAL_SKILL, OPERATIONS } from '../constants';

export type SkillByOp = Record<MathOperation, number>;

export interface AttemptSignal {
  operation:     MathOperation;
  difficulty:    number;
  isCorrect:     boolean;
  wasSkipped:    boolean;
  wasSuspicious: boolean;
  responseTimeMs: number;
}

export interface AdaptiveState {
  skill:          SkillByOp;
  recentSignals:  AttemptSignal[];   // capped FIFO (last 20)
}

const RECENT_CAP = 20;

export function createInitialState(seed?: Partial<SkillByOp>): AdaptiveState {
  const skill = {} as SkillByOp;
  for (const op of OPERATIONS) {
    skill[op] = seed?.[op] ?? ADAPTIVE_INITIAL_SKILL;
  }
  return { skill, recentSignals: [] };
}

export function appendSignal(state: AdaptiveState, signal: AttemptSignal): AdaptiveState {
  const next = [...state.recentSignals, signal];
  if (next.length > RECENT_CAP) next.splice(0, next.length - RECENT_CAP);
  return { ...state, recentSignals: next };
}

/** Return the operation with lowest recent accuracy; ties broken by fewer samples. */
export function weakestOperation(
  state: AdaptiveState,
  selectedOps: MathOperation[],
): MathOperation {
  const stats = new Map<MathOperation, { correct: number; total: number }>();
  for (const op of selectedOps) stats.set(op, { correct: 0, total: 0 });
  for (const s of state.recentSignals) {
    const entry = stats.get(s.operation);
    if (!entry) continue;
    entry.total += 1;
    if (s.isCorrect) entry.correct += 1;
  }
  let weakest = selectedOps[0];
  let lowestAcc = Infinity;
  for (const op of selectedOps) {
    const e = stats.get(op)!;
    const acc = e.total === 0 ? 0.5 : e.correct / e.total;
    if (acc < lowestAcc || (acc === lowestAcc && e.total < (stats.get(weakest)!.total))) {
      weakest = op;
      lowestAcc = acc;
    }
  }
  return weakest;
}

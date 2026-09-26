import type { Confidence, ResponseClass } from './types';

export interface ClassifyInput {
  selectedKey: string | null;
  isCorrect: boolean;
  confidence: Confidence | null;
  hint1Ms: number | null;
  hint2Ms: number | null;
  /** How many times the student switched to a different option before locking in. */
  switches: number;
  /** null = transfer item not attempted (or not offered). */
  transferCorrect: boolean | null;
}

/** Turns one response and its interaction signals into a diagnostic class. */
export function classifyResponse(i: ClassifyInput): ResponseClass {
  if (i.isCorrect) {
    if (i.confidence === 'guess') return 'lucky';
    const hinted = i.hint1Ms !== null || i.hint2Ms !== null;
    if (i.confidence === 'unsure' || hinted || i.switches >= 2) return 'fragile';
    return 'mastered';
  }
  // Wrong or skipped. Solving the fresh transfer item means the rule is known: a slip, not a gap.
  if (i.transferCorrect === true) return 'slip';
  if (i.selectedKey !== null && i.confidence === 'sure') return 'misconception';
  return 'gap';
}

/** Partial credit toward mastery of a skill. */
export const CLASS_CREDIT: Record<ResponseClass, number> = {
  mastered: 1,
  fragile: 0.65,
  slip: 0.4,
  lucky: 0.3,
  gap: 0,
  misconception: 0,
};

/** Number of option switches from the pick log: picks minus one, ignoring repeats of the same key. */
export function countSwitches(changes: { key: string }[]): number {
  let n = 0;
  for (let i = 1; i < changes.length; i++) if (changes[i].key !== changes[i - 1].key) n++;
  return n;
}

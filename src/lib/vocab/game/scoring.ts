/**
 * Word Hunt — scoring constants + catch-up quartering.
 */

/** Hidden-word points by winning guess number (index 0 = won on guess 1). */
export const WORD_POINTS: readonly number[] = [500, 400, 200, 150, 100, 50];

export const SENTENCE_POINTS_CLEAR    = 20; // first-try, clear correct usage
export const SENTENCE_POINTS_BASIC    = 10; // first-try, correct-but-basic
export const SENTENCE_POINTS_REVISED  = 10; // accepted only after revision

/** Catch-up rounds (past dates) score at 1/4, rounded up per component. */
export function applyCatchUp(points: number, isCatchUp: boolean): number {
  return isCatchUp ? Math.ceil(points / 4) : points;
}

/**
 * nextAttemptStats — the attempt/streak/accuracy arithmetic for a rated word.
 *
 * This block was byte-identical in `api/vocab/practice/rate` and
 * `api/vocab/flashcard/[themeId]/rate`, comment included. It is pure, so it is
 * extracted here and unit-tested directly instead of only through two HTTP
 * routes.
 *
 * Deliberately NOT unified with those routes' other differences (transaction
 * use, exposure bonus, flashcard counters, the practice due-date gate). Those
 * diverged before this extraction and may or may not be intentional — they stay
 * where they are.
 */

import type { SrsRating } from '@/lib/vocab/srs/engine';

export interface AttemptStats {
  totalAttempts:      number;
  correctAttempts:    number;
  consecutiveCorrect: number;
  consecutiveWrong:   number;
  accuracyRate:       number;
}

/**
 * Folds one rating into a word's running attempt stats.
 *
 * "unsure" is neutral — it does not count as an attempt and does not touch
 * either streak, so an unsure rating leaves every counter unchanged (accuracy
 * is still recomputed from the unchanged totals).
 */
export function nextAttemptStats(prev: Partial<AttemptStats> | null | undefined, rating: SrsRating): AttemptStats {
  const wasCorrect = rating === 'got_it';
  const wasWrong   = rating === 'missed_it';
  const isUnsure   = rating === 'unsure';

  const prevTotal   = prev?.totalAttempts      ?? 0;
  const prevCorrect = prev?.correctAttempts    ?? 0;
  const prevConsecC = prev?.consecutiveCorrect ?? 0;
  const prevConsecW = prev?.consecutiveWrong   ?? 0;

  const totalAttempts      = isUnsure ? prevTotal : prevTotal + 1;
  const correctAttempts    = wasCorrect ? prevCorrect + 1 : prevCorrect;
  const consecutiveCorrect = wasCorrect ? prevConsecC + 1 : (wasWrong ? 0 : prevConsecC);
  const consecutiveWrong   = wasWrong   ? prevConsecW + 1 : (wasCorrect ? 0 : prevConsecW);
  const accuracyRate       = totalAttempts > 0 ? correctAttempts / totalAttempts : 0;

  return { totalAttempts, correctAttempts, consecutiveCorrect, consecutiveWrong, accuracyRate };
}

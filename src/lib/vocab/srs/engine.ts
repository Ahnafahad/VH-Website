/**
 * SM-2 inspired Spaced Repetition Engine.
 * Operates on plain values — no DB calls.
 */

export type SrsRating = 'got_it' | 'unsure' | 'missed_it';

export interface SrsState {
  intervalDays: number;
  easeFactor:   number;
  repetitions:  number;
  nextReviewDate: Date;
}

const MIN_EASE      = 1.3;
const DEFAULT_EASE  = 2.5;

/**
 * Calculate next SRS state after a self-assessment rating.
 */
export function nextSrsState(current: SrsState, rating: SrsRating): SrsState {
  let { intervalDays, easeFactor, repetitions } = current;

  switch (rating) {
    case 'got_it':
      easeFactor    = Math.max(MIN_EASE, easeFactor + 0.1);
      repetitions  += 1;
      intervalDays  = repetitions === 1 ? 1 : Math.ceil(intervalDays * easeFactor);
      break;

    case 'unsure':
      // Interval unchanged, ease drops slightly
      easeFactor   = Math.max(MIN_EASE, easeFactor - 0.15);
      break;

    case 'missed_it':
      easeFactor   = Math.max(MIN_EASE, easeFactor - 0.2);
      repetitions  = 0;
      intervalDays = 1;
      break;
  }

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);

  return { intervalDays, easeFactor, repetitions, nextReviewDate };
}

/**
 * Check whether a correct quiz answer qualifies for the long-gap bonus.
 * The word must not have been seen as correct in the past 30+ days.
 */
export function isLongGap(lastCorrectAt: Date | null): boolean {
  if (!lastCorrectAt) return false;
  const daysSince = (Date.now() - lastCorrectAt.getTime()) / 86400000;
  return daysSince >= 30;
}

/**
 * Initialize a fresh SRS state for a word entering the pool.
 */
export function initialSrsState(): SrsState {
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + 1);
  return { intervalDays: 1, easeFactor: DEFAULT_EASE, repetitions: 0, nextReviewDate };
}

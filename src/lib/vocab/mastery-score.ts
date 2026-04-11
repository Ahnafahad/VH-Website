/**
 * T20 — Mastery Score Engine
 *
 * Pure functions — no DB calls. Compute mastery score deltas and levels.
 *
 * Score sources:
 *   Correct quiz answer          +10
 *   Long-gap correct (30+ days)  +15 bonus (on top of +10)
 *   "Got it" flashcard           +2
 *   Word exposure per session    +0.5, lifetime cap +10
 *
 * Score deductions:
 *   Wrong quiz (Word A)          -4
 *   Confusion penalty (Word A)   -3  (total -7 when user picks wrong word)
 *   Confusion penalty (Word B)   -2  (the word that was wrongly selected)
 *   "Missed it" flashcard        -1
 *   "Unsure" flashcard            0
 *
 * Time decay (applied externally by cron):
 *   Grace period 7 days, then -2%/day, floor 0.
 *
 * Mastery levels:
 *   new       0–20
 *   learning 21–60
 *   familiar 61–120
 *   strong  121–200
 *   mastered 201+
 */

import type { VocabMasteryLevel } from '@/lib/db/schema';

// ─── Constants ────────────────────────────────────────────────────────────────

const CORRECT_QUIZ        =  10;
const LONG_GAP_BONUS      =  15;
const WRONG_QUIZ          =  -4;
const CONFUSION_WORD_A    =  -3;  // additional penalty on top of WRONG_QUIZ
const CONFUSION_WORD_B    =  -2;
const FLASHCARD_GOT_IT    =   2;
const FLASHCARD_MISSED    =  -1;
const EXPOSURE_PER_SESSION = 0.5;
const EXPOSURE_CAP        =  10;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MasteryDelta {
  /** Amount to add to mastery_score (may be negative). */
  scoreDelta: number;
  /** New level computed from (currentScore + scoreDelta). */
  newLevel:   VocabMasteryLevel;
}

export type QuizOutcome =
  | { kind: 'correct'; isLongGap: boolean }
  | { kind: 'wrong_word_a' }   // user got this question wrong (it was the correct answer)
  | { kind: 'wrong_word_b' };  // user selected this word incorrectly (confusion penalty)

// ─── Level calculation ────────────────────────────────────────────────────────

export function masteryLevel(score: number): VocabMasteryLevel {
  if (score <= 20)  return 'new';
  if (score <= 60)  return 'learning';
  if (score <= 120) return 'familiar';
  if (score <= 200) return 'strong';
  return 'mastered';
}

// ─── Score deltas ─────────────────────────────────────────────────────────────

/**
 * Delta after a quiz answer event.
 * `currentScore` is needed to clamp the result at 0.
 */
export function quizDelta(
  outcome:      QuizOutcome,
  currentScore: number,
): MasteryDelta {
  let delta = 0;

  switch (outcome.kind) {
    case 'correct':
      delta = CORRECT_QUIZ + (outcome.isLongGap ? LONG_GAP_BONUS : 0);
      break;
    case 'wrong_word_a':
      delta = WRONG_QUIZ + CONFUSION_WORD_A; // -7 total
      break;
    case 'wrong_word_b':
      delta = CONFUSION_WORD_B; // -2
      break;
  }

  const raw = currentScore + delta;
  const clamped = Math.max(0, raw);
  return {
    scoreDelta: clamped - currentScore, // actual change after clamping
    newLevel:   masteryLevel(clamped),
  };
}

/**
 * Delta after a flashcard self-assessment.
 */
export function flashcardDelta(
  rating:       'got_it' | 'unsure' | 'missed_it',
  currentScore: number,
): MasteryDelta {
  let delta = 0;
  if (rating === 'got_it')    delta = FLASHCARD_GOT_IT;
  if (rating === 'missed_it') delta = FLASHCARD_MISSED;
  // 'unsure' → 0

  const raw = currentScore + delta;
  const clamped = Math.max(0, raw);
  return {
    scoreDelta: clamped - currentScore,
    newLevel:   masteryLevel(clamped),
  };
}

/**
 * Exposure bonus for a word seen as a correct-answer target in a session.
 * Respects the lifetime cap tracked by `currentExposurePoints`.
 */
export function exposureDelta(
  currentExposurePoints: number,
  currentScore:          number,
): MasteryDelta {
  const remaining = Math.max(0, EXPOSURE_CAP - currentExposurePoints);
  const delta     = Math.min(EXPOSURE_PER_SESSION, remaining);
  const raw       = currentScore + delta;
  return {
    scoreDelta: delta,
    newLevel:   masteryLevel(raw),
  };
}

/**
 * Daily time decay applied by cron after grace period.
 * Returns new score (clamped at 0). Does NOT return a MasteryDelta
 * because it's a bulk operation not tied to a single event.
 *
 * @param currentScore       Current mastery score.
 * @param daysSinceLastSeen  Calendar days since last_interaction_at.
 */
export function applyDecay(currentScore: number, daysSinceLastSeen: number): number {
  const GRACE_DAYS  = 7;
  const DECAY_RATE  = 0.02; // 2% per day

  if (daysSinceLastSeen <= GRACE_DAYS) return currentScore;

  const decayDays = daysSinceLastSeen - GRACE_DAYS;
  let score = currentScore;
  for (let d = 0; d < decayDays; d++) {
    score = Math.max(0, score - score * DECAY_RATE);
  }
  return score;
}

/**
 * LexiCore — Shared Constants
 *
 * Central location for magic numbers scattered across vocab modules.
 * Import from here instead of hardcoding values.
 */

// ─── Points ──────────────────────────────────────────────────────────────────

/** Points for a correct flashcard answer */
export const POINTS_FLASHCARD_CORRECT = 10;

/** Bonus points for correct answer after a long gap */
export const POINTS_LONG_GAP_BONUS = 5;

/** Points for an incorrect flashcard answer (participation) */
export const POINTS_FLASHCARD_WRONG = 2;

/** Bonus points for completing a flashcard session */
export const POINTS_SESSION_COMPLETE = 10;

/** Maximum points awardable in a single /points/award call */
export const POINTS_AWARD_MAX = 1000;

// ─── Quiz ────────────────────────────────────────────────────────────────────

/** Number of questions in a study quiz */
export const STUDY_MAX_QUESTIONS = 10;

/** Number of questions in a practice quiz */
export const PRACTICE_MAX_QUESTIONS = 20;

/** Default quiz pass threshold (70%) */
export const DEFAULT_PASS_THRESHOLD = 0.70;

// ─── SRS / Priority ─────────────────────────────────────────────────────────

/** Days since last seen before word is considered fully stale */
export const STALENESS_DAYS = 14;

/** Max exposure count tracked for priority scoring */
export const EXPOSURE_CAP = 20;

// ─── Student Level Thresholds ────────────────────────────────────────────────

/** Theme completion % to reach intermediate */
export const LEVEL_INTERMEDIATE_THRESHOLD = 0.40;

/** Theme completion % to reach advanced */
export const LEVEL_ADVANCED_THRESHOLD = 0.70;

// ─── Phase / Access ─────────────────────────────────────────────────────────

/** Maximum unit order accessible to phase-2 (free) users. Units 1–8. */
export const PHASE1_MAX_UNIT_ORDER = 8;

// ─── Word Pools ─────────────────────────────────────────────────────────────

/** Total words available to free users */
export const FREE_WORD_POOL = 100;

/** Total words available to paid users */
export const PAID_WORD_POOL = 800;

// ─── Limits ──────────────────────────────────────────────────────────────────

/** Max words shown in a review session */
export const REVIEW_WORD_LIMIT = 30;

/** Toast auto-dismiss timer (ms) */
export const TOAST_DISMISS_MS = 4500;

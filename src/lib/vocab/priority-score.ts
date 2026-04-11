/**
 * T19 — Priority Score System (Practice Quiz word selection)
 *
 * Ranks words 0–100 so lower-mastery / overdue / unseen words appear more
 * often in practice sessions.
 *
 * Factor weights:
 *   Days since last seen  30%
 *   Accuracy rate         30%
 *   SRS overdue status    20%
 *   Mastery level         15%
 *   Exposure count         5%
 */

import type { VocabMasteryLevel } from '@/lib/db/schema';

// ─── Input ────────────────────────────────────────────────────────────────────

export interface WordPriorityInput {
  wordId:            number;
  masteryLevel:      VocabMasteryLevel;
  masteryScore:      number;
  accuracyRate:      number;   // 0–1
  lastSeenAt:        Date | null;
  srsNextReviewDate: Date | null;
  exposureCount:     number;
}

export interface WordWithPriority extends WordPriorityInput {
  priorityScore: number; // 0–100
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysSince(date: Date | null): number {
  if (!date) return 999; // never seen → maximum staleness
  return (Date.now() - date.getTime()) / 86_400_000;
}

function srsOverdueDays(nextReviewDate: Date | null): number {
  if (!nextReviewDate) return 0;
  const overdue = (Date.now() - nextReviewDate.getTime()) / 86_400_000;
  return Math.max(0, overdue);
}

// Clamp a value to [0, 1]
function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// ─── Factor scorers (each returns 0–1, higher = higher priority) ─────────────

/** Days since last seen: 14+ days → ~1.0, today → ~0.0 */
function factorDaysSinceLastSeen(days: number): number {
  return clamp01(days / 14);
}

/** Low accuracy → high priority */
function factorAccuracy(accuracyRate: number): number {
  return clamp01(1 - accuracyRate);
}

/**
 * SRS overdue status:
 *   0 days overdue → 0
 *   3+ days overdue → large boost (capped at 1)
 */
function factorSrsOverdue(overdueDays: number): number {
  return clamp01(overdueDays / 3);
}

/**
 * Mastery level:
 *   new/learning → high priority, mastered → low (but never 0)
 */
function factorMasteryLevel(level: VocabMasteryLevel): number {
  const scores: Record<VocabMasteryLevel, number> = {
    new:      1.0,
    learning: 0.75,
    familiar: 0.5,
    strong:   0.25,
    mastered: 0.05,
  };
  return scores[level];
}

/**
 * Fewer exposures → small boost.
 * Capped at exposure_count = 20 (fully seen).
 */
function factorExposure(exposureCount: number): number {
  return clamp01(1 - exposureCount / 20);
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Compute priority score (0–100) for a single word.
 * Higher = more likely to appear in practice quiz.
 */
export function computePriorityScore(word: WordPriorityInput): number {
  const days    = daysSince(word.lastSeenAt);
  const overdue = srsOverdueDays(word.srsNextReviewDate);

  const raw =
    factorDaysSinceLastSeen(days)       * 0.30 +
    factorAccuracy(word.accuracyRate)    * 0.30 +
    factorSrsOverdue(overdue)            * 0.20 +
    factorMasteryLevel(word.masteryLevel) * 0.15 +
    factorExposure(word.exposureCount)   * 0.05;

  return Math.round(clamp01(raw) * 100);
}

/**
 * Rank a list of words by priority score (descending).
 * Returns the same list annotated with `priorityScore`.
 */
export function rankByPriority(words: WordPriorityInput[]): WordWithPriority[] {
  return words
    .map(w => ({ ...w, priorityScore: computePriorityScore(w) }))
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * Weighted random selection — words with higher priority score are more
 * likely to be chosen, but lower-scoring words are never fully excluded.
 *
 * Uses priority score as weight (minimum weight 1 to keep mastered words eligible).
 */
export function weightedSample(
  ranked: WordWithPriority[],
  count:  number,
): WordWithPriority[] {
  if (ranked.length <= count) return [...ranked];

  // Use swap-to-end instead of splice to avoid O(n²)
  const pool     = [...ranked];
  const weights  = pool.map(w => Math.max(1, w.priorityScore));
  const selected: WordWithPriority[] = [];
  let   poolSize = pool.length;

  while (selected.length < count && poolSize > 0) {
    // Build cumulative weights for binary search
    let total = 0;
    for (let i = 0; i < poolSize; i++) total += weights[i];

    let roll = Math.random() * total;

    for (let i = 0; i < poolSize; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        selected.push(pool[i]);
        // Swap selected item with last item and shrink pool
        poolSize--;
        pool[i]    = pool[poolSize];
        weights[i] = weights[poolSize];
        break;
      }
    }
  }

  return selected;
}

/**
 * Pure scoring logic for the online tests module.
 * No DB access here — everything is unit-testable.
 */

import type { TestSection, TestQuestion } from '@/lib/db/schema';

export interface SectionScore {
  sectionId: number;
  title: string;
  correct: number;
  wrong: number;
  unattempted: number;
  totalQuestions: number;
  score: number;
  maxScore: number;
  percentage: number;
  thresholdPercent: number | null;
  passed: boolean | null; // null when no threshold configured
}

export interface AttemptScore {
  totalScore: number;
  maxScore: number;
  totalCorrect: number;
  totalWrong: number;
  totalUnattempted: number;
  percentage: number;
  sections: SectionScore[];
  /** Question ids that had no answer key loaded and were excluded from marks */
  unscoredQuestionIds: number[];
}

/** answers: questionId → selectedKey (only answered questions present) */
export function scoreAttempt(
  sections: TestSection[],
  questions: TestQuestion[],
  answers: Map<number, string>,
): AttemptScore {
  const bySection = new Map<number, TestQuestion[]>();
  for (const q of questions) {
    const list = bySection.get(q.sectionId) ?? [];
    list.push(q);
    bySection.set(q.sectionId, list);
  }

  const sectionScores: SectionScore[] = [];
  const unscoredQuestionIds: number[] = [];
  let totalScore = 0, maxScore = 0;
  let totalCorrect = 0, totalWrong = 0, totalUnattempted = 0;

  for (const section of [...sections].sort((a, b) => a.order - b.order)) {
    const qs = bySection.get(section.id) ?? [];
    let correct = 0, wrong = 0, unattempted = 0;

    for (const q of qs) {
      const selected = answers.get(q.id);
      if (!selected) { unattempted++; continue; }
      if (!q.correctKey) { unscoredQuestionIds.push(q.id); unattempted++; continue; }
      if (selected === q.correctKey) correct++;
      else wrong++;
    }

    const score = correct * section.marksPerCorrect - wrong * section.penaltyPerWrong;
    const sectionMax = qs.length * section.marksPerCorrect;
    const percentage = sectionMax > 0 ? (score / sectionMax) * 100 : 0;
    const passed = section.thresholdPercent != null ? percentage >= section.thresholdPercent : null;

    sectionScores.push({
      sectionId: section.id,
      title: section.title,
      correct, wrong, unattempted,
      totalQuestions: qs.length,
      score: round2(score),
      maxScore: sectionMax,
      percentage: round2(percentage),
      thresholdPercent: section.thresholdPercent,
      passed,
    });

    totalScore += score;
    maxScore += sectionMax;
    totalCorrect += correct;
    totalWrong += wrong;
    totalUnattempted += unattempted;
  }

  return {
    totalScore: round2(totalScore),
    maxScore,
    totalCorrect,
    totalWrong,
    totalUnattempted,
    percentage: maxScore > 0 ? round2((totalScore / maxScore) * 100) : 0,
    sections: sectionScores,
    unscoredQuestionIds,
  };
}

export interface RankedEntry {
  attemptId: number;
  totalScore: number;
  rank: number;
  percentile: number;
}

/** Standard competition ranking (1224). Percentile = % of scores strictly below. */
export function computeRanks(entries: { attemptId: number; totalScore: number }[]): RankedEntry[] {
  const sorted = [...entries].sort((a, b) => b.totalScore - a.totalScore);
  const n = sorted.length;
  const out: RankedEntry[] = [];
  let rank = 0, prevScore: number | null = null;

  sorted.forEach((e, i) => {
    if (prevScore === null || e.totalScore < prevScore) {
      rank = i + 1;
      prevScore = e.totalScore;
    }
    const below = sorted.filter(s => s.totalScore < e.totalScore).length;
    out.push({
      attemptId: e.attemptId,
      totalScore: e.totalScore,
      rank,
      percentile: n > 1 ? round2((below / n) * 100) : 100,
    });
  });

  return out;
}

// ─── Cohort ranking (test × batch × product) ─────────────────────────────────
// Used by the non-diagnostic student results page (see service.ts:getTestResults).
// FBS diagnostics keep the plain computeRanks() above untouched — they have
// their own separate leaderboard (api/fbs-diagnosis/[slug]/leaderboard).

export interface CohortRankEntry {
  attemptId: number;
  userId: number;
  totalScore: number;
  submittedAt: number; // epoch ms — earlier wins the tie-break
  correct: number;
  wrong: number;
}

export interface CohortRankedEntry {
  attemptId: number;
  userId: number;
  totalScore: number;
  rank: number;
  percentile: number;
}

/** True when cohort ranking (batch/product scoped, tie-broken) should be used
 * instead of the plain test-wide computeRanks(). False for diagnostics and for
 * tests with no submissions at all (nothing to scope). */
export function useCohortRanking(test: { isDiagnostic: boolean }, submittedCount: number): boolean {
  return !test.isDiagnostic && submittedCount > 0;
}

/**
 * Standard competition ranking (1224), same as computeRanks — but the order
 * used to pick a definite Top 5 (and their listed order) follows a
 * deterministic tie-break: earlier submission first, then higher accuracy.
 * The tie-break only decides which members of a tied group make the cut and
 * their list order — it never changes the rank NUMBER two equally-scored
 * students see, which stays standard competition ranking (ties share a rank).
 */
export function rankCohort(entries: CohortRankEntry[]): CohortRankedEntry[] {
  function accuracy(e: CohortRankEntry): number {
    const attempted = e.correct + e.wrong;
    return attempted > 0 ? e.correct / attempted : 0;
  }

  const sorted = [...entries].sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (a.submittedAt !== b.submittedAt) return a.submittedAt - b.submittedAt;
    return accuracy(b) - accuracy(a);
  });

  const n = sorted.length;
  const out: CohortRankedEntry[] = [];
  let rank = 0, prevScore: number | null = null;

  sorted.forEach((e, i) => {
    if (prevScore === null || e.totalScore < prevScore) {
      rank = i + 1;
      prevScore = e.totalScore;
    }
    const below = sorted.filter(s => s.totalScore < e.totalScore).length;
    out.push({
      attemptId: e.attemptId,
      userId: e.userId,
      totalScore: e.totalScore,
      rank,
      percentile: n > 1 ? round2((below / n) * 100) : 100,
    });
  });

  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

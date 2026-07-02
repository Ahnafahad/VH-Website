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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

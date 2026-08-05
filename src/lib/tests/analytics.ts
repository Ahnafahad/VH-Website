/**
 * Pure metric computations for the teacher/admin "Test Analytics" overview
 * (Wave 3, part 2). No DB access here — everything is unit-testable.
 * Fed by src/app/api/admin/tests/[id]/analytics/route.ts.
 *
 * No topic tags are used anywhere here (explicitly vetoed) — "commonly got
 * wrong" is per-question only, grouped at most by the section it belongs to.
 *
 * REJECTED metric — "average time taken": testAttempts.startedAt/submittedAt
 * are both real, but a live check (2026-08-05) found every populated test is
 * ~100% offline-mode (0 or 1 online attempt each). Offline attempts have no
 * live timer, so submittedAt-startedAt there measures how long the row sat
 * open before being marked submitted, not time-on-test (one real sample was
 * 246 minutes) — restricting to online-only would leave n=0 or n=1 per test.
 * Do not add this back without re-checking the online/offline mix.
 */

import type { SectionScore } from './scoring';

// ─── Basic stats helpers ────────────────────────────────────────────────────

export function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return round2(nums.reduce((s, n) => s + n, 0) / nums.length);
}

export function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return round2(
    sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2,
  );
}

export function stdDev(nums: number[]): number {
  if (nums.length === 0) return 0;
  const avg = nums.reduce((s, n) => s + n, 0) / nums.length;
  const variance = nums.reduce((s, n) => s + (n - avg) ** 2, 0) / nums.length;
  return round2(Math.sqrt(variance));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Input shapes (raw, DB-agnostic) ────────────────────────────────────────

export interface RawAttempt {
  attemptId: number;
  userId: number;
  userName: string | null;
  userEmail: string;
  status: 'in_progress' | 'submitted' | 'banned';
  totalScore: number | null;
  submittedAt: number | null; // epoch ms
  /** Already-computed per-section breakdown, stored at submit time. */
  sectionScores: SectionScore[] | null;
}

export interface RawSection {
  sectionId: number;
  title: string;
  order: number;
}

export interface RawQuestion {
  questionId: number;
  sectionId: number;
  number: number;
  correctKey: string | null;
}

export interface RawAnswer {
  attemptId: number;
  questionId: number;
  selectedKey: string | null;
}

export interface RawViolation {
  action: string;
}

export interface AnalyticsInput {
  eligibleCount: number;
  testTotalMarks: number;
  /** ALL attempts regardless of status (in_progress/submitted/banned). */
  attempts: RawAttempt[];
  sections: RawSection[];
  questions: RawQuestion[];
  /** Answers belonging to SUBMITTED attempts only. */
  answers: RawAnswer[];
}

// ─── Output shapes ───────────────────────────────────────────────────────────

export interface ScoreDistributionBucket {
  label: string;
  count: number;
}

export interface QuestionStat {
  questionId: number;
  number: number;
  sectionId: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  /** correct / (correct + wrong), as a percentage. Null when nobody answered it. */
  accuracy: number | null;
}

export interface SectionStat {
  sectionId: number;
  title: string;
  averageScore: number;
  maxScore: number;
  averagePercentage: number;
  /** correct / (correct + wrong) across every submitted attempt's answers in this section, as a percentage. */
  accuracy: number | null;
}

export interface StudentRow {
  attemptId: number;
  userId: number;
  name: string | null;
  email: string;
  totalScore: number;
  percentage: number;
  submittedAt: number | null;
}

export interface ViolationStats {
  totalCount: number;
  byAction: Record<string, number>;
}

export interface TestAnalytics {
  participation: { eligible: number; attempted: number; attemptedPercent: number };
  completion: { attempted: number; submitted: number; completionPercent: number };
  averageScore: number;
  averagePercentage: number;
  medianScore: number;
  highestScore: number;
  lowestScore: number;
  stdDevScore: number;
  scoreDistribution: ScoreDistributionBucket[];
  sections: SectionStat[];
  questions: QuestionStat[];
  mostWrong: QuestionStat[];
  mostSkipped: QuestionStat[];
  top5: StudentRow[];
  bottomPerformers: StudentRow[];
}

const TOP_N = 8;

export function computeTestAnalytics(input: AnalyticsInput): TestAnalytics {
  const { eligibleCount, testTotalMarks, attempts, sections, questions, answers } = input;

  const submitted = attempts.filter(a => a.status === 'submitted');
  const scores = submitted.map(a => a.totalScore ?? 0);
  const percentages = scores.map(s => (testTotalMarks > 0 ? (s / testTotalMarks) * 100 : 0));

  const attemptedCount = attempts.length;
  const participation = {
    eligible: eligibleCount,
    attempted: attemptedCount,
    attemptedPercent: eligibleCount > 0 ? round2((attemptedCount / eligibleCount) * 100) : 0,
  };
  const completion = {
    attempted: attemptedCount,
    submitted: submitted.length,
    completionPercent: attemptedCount > 0 ? round2((submitted.length / attemptedCount) * 100) : 0,
  };

  const scoreDistribution = computeScoreDistribution(percentages);
  const sectionStats = computeSectionStats(sections, submitted);
  const questionStats = computeQuestionStats(questions, answers, submitted.length);

  const mostWrong = [...questionStats]
    .filter(q => q.wrongCount > 0)
    .sort((a, b) => b.wrongCount - a.wrongCount || a.number - b.number)
    .slice(0, TOP_N);
  const mostSkipped = [...questionStats]
    .filter(q => q.skippedCount > 0)
    .sort((a, b) => b.skippedCount - a.skippedCount || a.number - b.number)
    .slice(0, TOP_N);

  const ranked = [...submitted].sort(
    (a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0) || a.attemptId - b.attemptId,
  );
  const toRow = (a: RawAttempt): StudentRow => ({
    attemptId: a.attemptId,
    userId: a.userId,
    name: a.userName,
    email: a.userEmail,
    totalScore: a.totalScore ?? 0,
    percentage: testTotalMarks > 0 ? round2(((a.totalScore ?? 0) / testTotalMarks) * 100) : 0,
    submittedAt: a.submittedAt,
  });
  const top5 = ranked.slice(0, 5).map(toRow);
  const bottomPerformers = [...ranked].reverse().slice(0, 5).map(toRow);

  return {
    participation,
    completion,
    averageScore: average(scores),
    averagePercentage: average(percentages),
    medianScore: median(scores),
    highestScore: scores.length ? Math.max(...scores) : 0,
    lowestScore: scores.length ? Math.min(...scores) : 0,
    stdDevScore: stdDev(scores),
    scoreDistribution,
    sections: sectionStats,
    questions: questionStats,
    mostWrong,
    mostSkipped,
    top5,
    bottomPerformers,
  };
}

export function computeViolationStats(violations: RawViolation[]): ViolationStats {
  const byAction: Record<string, number> = {};
  for (const v of violations) byAction[v.action] = (byAction[v.action] ?? 0) + 1;
  return { totalCount: violations.length, byAction };
}

function computeScoreDistribution(percentages: number[]): ScoreDistributionBucket[] {
  const buckets = [
    { label: '0–20%', min: 0, max: 20 },
    { label: '20–40%', min: 20, max: 40 },
    { label: '40–60%', min: 40, max: 60 },
    { label: '60–80%', min: 60, max: 80 },
    { label: '80–100%', min: 80, max: 101 }, // inclusive of exactly 100
  ];
  return buckets.map(b => ({
    label: b.label,
    count: percentages.filter(p => p >= b.min && p < b.max).length,
  }));
}

function computeSectionStats(sections: RawSection[], submitted: RawAttempt[]): SectionStat[] {
  return [...sections]
    .sort((a, b) => a.order - b.order)
    .map(s => {
      const entries = submitted
        .flatMap(a => a.sectionScores ?? [])
        .filter(sc => sc.sectionId === s.sectionId);
      const scores = entries.map(e => e.score);
      const percentages = entries.map(e => e.percentage);
      const correctSum = entries.reduce((sum, e) => sum + e.correct, 0);
      const wrongSum = entries.reduce((sum, e) => sum + e.wrong, 0);
      return {
        sectionId: s.sectionId,
        title: s.title,
        averageScore: average(scores),
        maxScore: entries[0]?.maxScore ?? 0,
        averagePercentage: average(percentages),
        accuracy: correctSum + wrongSum > 0 ? round2((correctSum / (correctSum + wrongSum)) * 100) : null,
      };
    });
}

function computeQuestionStats(
  questions: RawQuestion[],
  answers: RawAnswer[],
  submittedCount: number,
): QuestionStat[] {
  const byQuestion = new Map<number, { correct: number; wrong: number; skipped: number }>();
  for (const q of questions) {
    byQuestion.set(q.questionId, { correct: 0, wrong: 0, skipped: submittedCount });
  }
  const keyByQuestion = new Map(questions.map(q => [q.questionId, q.correctKey]));

  for (const a of answers) {
    const stat = byQuestion.get(a.questionId);
    if (!stat || !a.selectedKey) continue;
    stat.skipped--;
    const key = keyByQuestion.get(a.questionId);
    if (key && a.selectedKey === key) stat.correct++;
    else stat.wrong++;
  }

  return questions
    .map(q => {
      const stat = byQuestion.get(q.questionId)!;
      return {
        questionId: q.questionId,
        number: q.number,
        sectionId: q.sectionId,
        correctCount: stat.correct,
        wrongCount: stat.wrong,
        skippedCount: stat.skipped,
        accuracy:
          stat.correct + stat.wrong > 0
            ? round2((stat.correct / (stat.correct + stat.wrong)) * 100)
            : null,
      };
    })
    .sort((a, b) => a.number - b.number);
}

// ─── Student Progress Metrics — Pure Computation ───────────────────────────────
// No DB imports — unit-testable without a live DB connection.
// The DB fetch layer is in student-metrics.ts.
//
// Covers the 11 non-LexiCore metrics from the locked spec (DECISIONS.md §12):
// test average % · latest rank + percentile · rank trend · marks trend ·
// per-section accuracy breakdown · strongest/weakest section · accuracy vs
// batch average per section · participation rate · skipped/unanswered rate ·
// improvement delta + consistency (variance) · proctoring violation count.
//
// FBS diagnostic attempts (isDiagnostic) are excluded from every metric here —
// filtered inside this pure function so the rule can't be forgotten by a caller.

export interface MetricsSectionScore {
  title:          string;
  correct:        number;
  wrong:          number;
  unattempted:    number;
  totalQuestions: number;
}

/** One submitted attempt, already scored. `isDiagnostic` drives the exclusion rule. */
export interface MetricsAttempt {
  attemptId:        number;
  testId:           number;
  isDiagnostic:     boolean;
  submittedAt:      Date;
  percentage:       number; // 0-100
  rank:             number;
  totalStudents:    number;
  percentile:       number;
  totalUnattempted: number;
  totalQuestions:   number;
  sections:         MetricsSectionScore[];
}

/** Batch-wide correct/wrong totals per section title (pre-filtered to non-diagnostic tests by the caller). */
export interface BatchSectionAgg {
  title:   string;
  correct: number;
  wrong:   number;
}

export interface StudentMetricsInput {
  attempts:             MetricsAttempt[];
  batchSectionTotals:   BatchSectionAgg[];
  /** total published, non-diagnostic tests site-wide — the participation-rate denominator */
  availableTestsCount:  number;
  /** test_violations rows tied to this student's non-diagnostic submitted attempts */
  violationCount:       number;
}

export interface RankTrendPoint {
  testId:        number;
  attemptId:     number;
  submittedAt:   string; // ISO
  rank:          number;
  totalStudents: number;
  percentile:    number;
}

export interface MarksTrendPoint {
  testId:      number;
  attemptId:   number;
  submittedAt: string; // ISO
  percentage:  number;
}

export interface SectionAccuracyRow {
  title:                   string;
  correct:                 number;
  wrong:                   number;
  unattempted:             number;
  accuracyPercent:         number;       // correct / (correct+wrong), 0-100
  batchAvgAccuracyPercent: number | null; // null if the batch has no answered data for this title
  deltaVsBatch:            number | null; // accuracyPercent - batchAvgAccuracyPercent
}

export interface StudentMetrics {
  testsAttempted:      number;
  testAveragePercent:  number | null;
  latestRank:          number | null;
  latestPercentile:    number | null;
  latestTotalStudents: number | null;
  rankTrend:           RankTrendPoint[];   // chronological, oldest first
  marksTrend:          MarksTrendPoint[];  // chronological, oldest first
  sectionAccuracy:     SectionAccuracyRow[]; // weakest first
  strongestSection:    string | null;
  weakestSection:       string | null;
  participationRate:   number | null; // 0-100
  skippedRate:          number | null; // 0-100
  improvementDelta:     number | null; // last % - first %, null if <2 attempts
  consistency:          number | null; // population variance of %, null if <2 attempts
  violationCount:       number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeStudentMetrics(input: StudentMetricsInput): StudentMetrics {
  const nonDiagnostic = input.attempts.filter(a => !a.isDiagnostic);
  const sorted = [...nonDiagnostic].sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
  const n = sorted.length;

  const testsAttempted = new Set(sorted.map(a => a.testId)).size;

  const testAveragePercent = n > 0
    ? round2(sorted.reduce((s, a) => s + a.percentage, 0) / n)
    : null;

  const latest = n > 0 ? sorted[n - 1] : null;

  const rankTrend: RankTrendPoint[] = sorted.map(a => ({
    testId: a.testId,
    attemptId: a.attemptId,
    submittedAt: a.submittedAt.toISOString(),
    rank: a.rank,
    totalStudents: a.totalStudents,
    percentile: a.percentile,
  }));

  const marksTrend: MarksTrendPoint[] = sorted.map(a => ({
    testId: a.testId,
    attemptId: a.attemptId,
    submittedAt: a.submittedAt.toISOString(),
    percentage: a.percentage,
  }));

  // Section accuracy aggregated across this student's own attempts, by title.
  const sectionAgg = new Map<string, { correct: number; wrong: number; unattempted: number }>();
  for (const a of sorted) {
    for (const s of a.sections) {
      const agg = sectionAgg.get(s.title) ?? { correct: 0, wrong: 0, unattempted: 0 };
      agg.correct += s.correct;
      agg.wrong += s.wrong;
      agg.unattempted += s.unattempted;
      sectionAgg.set(s.title, agg);
    }
  }

  const batchByTitle = new Map(input.batchSectionTotals.map(b => [b.title, b]));

  const sectionAccuracy: SectionAccuracyRow[] = Array.from(sectionAgg.entries())
    .map(([title, agg]) => {
      const answered = agg.correct + agg.wrong;
      const accuracyPercent = answered > 0 ? round2((agg.correct / answered) * 100) : 0;
      const batch = batchByTitle.get(title);
      const batchAnswered = batch ? batch.correct + batch.wrong : 0;
      const batchAvgAccuracyPercent = batch && batchAnswered > 0
        ? round2((batch.correct / batchAnswered) * 100)
        : null;
      return {
        title,
        correct: agg.correct,
        wrong: agg.wrong,
        unattempted: agg.unattempted,
        accuracyPercent,
        batchAvgAccuracyPercent,
        deltaVsBatch: batchAvgAccuracyPercent != null ? round2(accuracyPercent - batchAvgAccuracyPercent) : null,
      };
    })
    .filter(s => (s.correct + s.wrong) > 0)
    .sort((a, b) => a.accuracyPercent - b.accuracyPercent);

  const strongestSection = sectionAccuracy.length > 0 ? sectionAccuracy[sectionAccuracy.length - 1].title : null;
  const weakestSection = sectionAccuracy.length > 0 ? sectionAccuracy[0].title : null;

  const participationRate = input.availableTestsCount > 0
    ? round2((testsAttempted / input.availableTestsCount) * 100)
    : null;

  const totalUnattempted = sorted.reduce((s, a) => s + a.totalUnattempted, 0);
  const totalQuestions = sorted.reduce((s, a) => s + a.totalQuestions, 0);
  const skippedRate = totalQuestions > 0 ? round2((totalUnattempted / totalQuestions) * 100) : null;

  const improvementDelta = n >= 2 ? round2(sorted[n - 1].percentage - sorted[0].percentage) : null;

  let consistency: number | null = null;
  if (n >= 2 && testAveragePercent !== null) {
    const variance = sorted.reduce((s, a) => s + (a.percentage - testAveragePercent) ** 2, 0) / n;
    consistency = round2(variance);
  }

  return {
    testsAttempted,
    testAveragePercent,
    latestRank: latest ? latest.rank : null,
    latestPercentile: latest ? latest.percentile : null,
    latestTotalStudents: latest ? latest.totalStudents : null,
    rankTrend,
    marksTrend,
    sectionAccuracy,
    strongestSection,
    weakestSection,
    participationRate,
    skippedRate,
    improvementDelta,
    consistency,
    violationCount: input.violationCount,
  };
}

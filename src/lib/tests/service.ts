/**
 * Server-side data service for the online tests module.
 * Used by API routes and server components. Never leaks correctKey to takers.
 */

import { db } from '@/lib/db';
import {
  tests, testSections, testQuestionGroups, testQuestions,
  testWindows, testAttempts, testAnswers,
  type Test, type TestWindow, type TestAttempt, type TestOption,
} from '@/lib/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { effectiveWindowState, resultsVisible, type EffectiveWindowState } from './windows';
import { scoreAttempt, computeRanks, type AttemptScore } from './scoring';
import { parseChosenSections } from './diagnostic';

// ─── Listing ──────────────────────────────────────────────────────────────────

export interface TestListEntry {
  id: number;
  slug: string;
  title: string;
  bucket: string;
  description: string | null;
  syllabus: string | null;
  totalQuestions: number;
  totalMarks: number;
  windows: Array<{
    id: number;
    mode: string;
    opensAt: number;      // epoch ms (serializable)
    closesAt: number;
    durationMinutes: number | null;
    state: EffectiveWindowState;
  }>;
  attempt: {
    id: number;
    mode: string;
    status: string;
    submittedAt: number | null;
  } | null;
  resultsAvailable: boolean;
}

export async function getTestListForUser(userId: number): Promise<TestListEntry[]> {
  const now = new Date();
  const rows = await db.select().from(tests).where(
    and(eq(tests.status, 'published'), eq(tests.isDiagnostic, false)),
  );
  if (rows.length === 0) return [];

  const testIds = rows.map(t => t.id);
  const [windows, attempts] = await Promise.all([
    db.select().from(testWindows).where(inArray(testWindows.testId, testIds)),
    db.select().from(testAttempts).where(
      and(inArray(testAttempts.testId, testIds), eq(testAttempts.userId, userId)),
    ),
  ]);

  return rows.map(t => {
    const tWindows = windows.filter(w => w.testId === t.id);
    const attempt = attempts.find(a => a.testId === t.id) ?? null;
    return {
      id: t.id,
      slug: t.slug,
      title: t.title,
      bucket: t.bucket,
      description: t.description,
      syllabus: t.syllabus,
      totalQuestions: t.totalQuestions,
      totalMarks: t.totalMarks,
      windows: tWindows
        .sort((a, b) => a.opensAt.getTime() - b.opensAt.getTime())
        .map(w => ({
          id: w.id,
          mode: w.mode,
          opensAt: w.opensAt.getTime(),
          closesAt: w.closesAt.getTime(),
          durationMinutes: w.durationMinutes,
          state: effectiveWindowState(w, now),
        })),
      attempt: attempt && {
        id: attempt.id,
        mode: attempt.mode,
        status: attempt.status,
        submittedAt: attempt.submittedAt?.getTime() ?? null,
      },
      resultsAvailable: resultsVisible(t, tWindows, now) &&
        attempt?.status === 'submitted',
    };
  });
}

// ─── Test content (for taking) ────────────────────────────────────────────────

export interface TakingQuestion {
  id: number;
  number: number;
  order: number;
  groupId: number | null;
  type: string;
  stem: string;
  options: TestOption[];
  imageUrl: string | null;
  explanation: string | null;
}

export interface TakingSection {
  id: number;
  order: number;
  title: string;
  totalQuestions: number;
  marksPerCorrect: number;
  penaltyPerWrong: number;
  groups: Array<{
    id: number;
    order: number;
    kind: string;
    title: string | null;
    content: string;
    sharedOptions: TestOption[] | null;
  }>;
  questions: TakingQuestion[];
}

/**
 * Full test content WITHOUT answer keys — safe to send to a taker.
 * When restrictSectionIds is provided, only sections in that set are returned
 * (used by the diagnostic elective mechanic to send only the 4 chosen sections).
 */
export async function getTestContent(
  testId: number,
  restrictSectionIds?: number[],
): Promise<TakingSection[]> {
  const allSections = await db.select().from(testSections)
    .where(eq(testSections.testId, testId));
  const sections = restrictSectionIds
    ? allSections.filter(s => restrictSectionIds.includes(s.id))
    : allSections;
  if (sections.length === 0) return [];
  const sectionIds = sections.map(s => s.id);

  const [groups, questions] = await Promise.all([
    db.select().from(testQuestionGroups).where(inArray(testQuestionGroups.sectionId, sectionIds)),
    db.select().from(testQuestions).where(inArray(testQuestions.sectionId, sectionIds)),
  ]);

  return sections
    .sort((a, b) => a.order - b.order)
    .map(s => ({
      id: s.id,
      order: s.order,
      title: s.title,
      totalQuestions: s.totalQuestions,
      marksPerCorrect: s.marksPerCorrect,
      penaltyPerWrong: s.penaltyPerWrong,
      groups: groups
        .filter(g => g.sectionId === s.id)
        .sort((a, b) => a.order - b.order)
        .map(g => ({
          id: g.id,
          order: g.order,
          kind: g.kind,
          title: g.title,
          content: g.content,
          sharedOptions: g.sharedOptions ? (JSON.parse(g.sharedOptions) as TestOption[]) : null,
        })),
      questions: questions
        .filter(q => q.sectionId === s.id)
        .sort((a, b) => a.order - b.order)
        .map(q => ({
          id: q.id,
          number: q.number,
          order: q.order,
          groupId: q.groupId,
          type: q.type,
          stem: q.stem,
          options: JSON.parse(q.options) as TestOption[],
          imageUrl: q.imageUrl,
          explanation: q.explanation,
        })),
    }));
}

// ─── Lookups ──────────────────────────────────────────────────────────────────

export async function getPublishedTestBySlug(slug: string): Promise<{ test: Test; windows: TestWindow[] } | null> {
  const test = await db.select().from(tests).where(eq(tests.slug, slug)).get();
  if (!test) return null;
  const windows = await db.select().from(testWindows).where(eq(testWindows.testId, test.id));
  return { test, windows };
}

export async function getUserAttempt(testId: number, userId: number): Promise<TestAttempt | null> {
  const row = await db.select().from(testAttempts)
    .where(and(eq(testAttempts.testId, testId), eq(testAttempts.userId, userId)))
    .get();
  return row ?? null;
}

// ─── Scoring an attempt (server-side, at submit) ─────────────────────────────

export async function scoreAttemptById(
  attemptId: number,
  testId: number,
  restrictSectionIds?: number[],
): Promise<AttemptScore> {
  const allSections = await db.select().from(testSections).where(eq(testSections.testId, testId));
  const sections = restrictSectionIds
    ? allSections.filter(s => restrictSectionIds.includes(s.id))
    : allSections;
  const sectionIds = sections.map(s => s.id);
  const [questions, answers] = await Promise.all([
    db.select().from(testQuestions).where(inArray(testQuestions.sectionId, sectionIds)),
    db.select().from(testAnswers).where(eq(testAnswers.attemptId, attemptId)),
  ]);
  const answerMap = new Map<number, string>();
  for (const a of answers) {
    if (a.selectedKey) answerMap.set(a.questionId, a.selectedKey);
  }
  return scoreAttempt(sections, questions, answerMap);
}

// ─── Results (after windows close) ────────────────────────────────────────────

export interface TestResultsPayload {
  test: { slug: string; title: string; bucket: string; totalMarks: number; totalQuestions: number };
  me: {
    attemptId: number;
    mode: string;
    totalScore: number;
    percentage: number;
    totalCorrect: number;
    totalWrong: number;
    totalUnattempted: number;
    rank: number;
    percentile: number;
    sections: AttemptScore['sections'];
    /** questionId → { selected, correct, isCorrect } */
    responses: Record<number, { selected: string | null; correct: string | null; isCorrect: boolean | null }>;
  } | null;
  classStats: {
    totalStudents: number;
    averageScore: number;
    top5Average: number;
    highest: number;
    lowest: number;
  };
  questionAnalytics: Record<number, { correctCount: number; wrongCount: number; skippedCount: number }>;
  sections: TakingSection[];
  answerKey: Record<number, string | null>; // questionId → correctKey (revealed post-close)
}

export async function getTestResults(testId: number, userId: number): Promise<TestResultsPayload | null> {
  const test = await db.select().from(tests).where(eq(tests.id, testId)).get();
  if (!test) return null;

  const submitted = await db.select().from(testAttempts).where(
    and(eq(testAttempts.testId, testId), eq(testAttempts.status, 'submitted')),
  );

  const ranks = computeRanks(
    submitted.map(a => ({ attemptId: a.id, totalScore: a.totalScore ?? 0 })),
  );

  // Diagnostic elective mechanic: when the caller's own submitted attempt has a
  // subject selection, restrict all returned content/breakdown to those 4
  // sections and recompute the marks denominator over the attempted sections.
  const mine = submitted.find(a => a.userId === userId) ?? null;
  const chosenIds = test.isDiagnostic ? parseChosenSections(mine?.chosenSections ?? null) : [];
  const restrictIds = chosenIds.length > 0 ? chosenIds : undefined;

  // Marks denominator: attempted-section marks for a diagnostic with a
  // selection (= 40), otherwise the whole test's totalMarks.
  let attemptedMarks = test.totalMarks;
  if (restrictIds) {
    const sectionMarkRows = await db.select({ id: testSections.id, totalMarks: testSections.totalMarks })
      .from(testSections).where(eq(testSections.testId, testId));
    attemptedMarks = sectionMarkRows
      .filter(s => restrictIds.includes(s.id))
      .reduce((sum, s) => sum + s.totalMarks, 0);
  }

  const scores = submitted.map(a => a.totalScore ?? 0).sort((a, b) => b - a);
  const top5 = scores.slice(0, 5);
  const classStats = {
    totalStudents: submitted.length,
    averageScore: scores.length ? round2(scores.reduce((s, x) => s + x, 0) / scores.length) : 0,
    top5Average: top5.length ? round2(top5.reduce((s, x) => s + x, 0) / top5.length) : 0,
    highest: scores[0] ?? 0,
    lowest: scores[scores.length - 1] ?? 0,
  };

  // Question-level class analytics
  const sections = await getTestContent(testId, restrictIds);
  const allQuestionIds = sections.flatMap(s => s.questions.map(q => q.id));
  const keyRows = allQuestionIds.length
    ? await db.select({ id: testQuestions.id, correctKey: testQuestions.correctKey })
        .from(testQuestions).where(inArray(testQuestions.id, allQuestionIds))
    : [];
  const keyMap = new Map(keyRows.map(k => [k.id, k.correctKey]));

  const attemptIds = submitted.map(a => a.id);
  const allAnswers = attemptIds.length
    ? await db.select().from(testAnswers).where(inArray(testAnswers.attemptId, attemptIds))
    : [];

  const questionAnalytics: TestResultsPayload['questionAnalytics'] = {};
  for (const qid of allQuestionIds) {
    questionAnalytics[qid] = { correctCount: 0, wrongCount: 0, skippedCount: submitted.length };
  }
  for (const a of allAnswers) {
    const stats = questionAnalytics[a.questionId];
    if (!stats || !a.selectedKey) continue;
    stats.skippedCount--;
    const key = keyMap.get(a.questionId);
    if (key && a.selectedKey === key) stats.correctCount++;
    else stats.wrongCount++;
  }

  // Own attempt
  let me: TestResultsPayload['me'] = null;
  if (mine) {
    const myRank = ranks.find(r => r.attemptId === mine.id)!;
    const myAnswers = allAnswers.filter(a => a.attemptId === mine.id);
    const answered = new Map(myAnswers.map(a => [a.questionId, a.selectedKey]));
    const responses: NonNullable<TestResultsPayload['me']>['responses'] = {};
    for (const qid of allQuestionIds) {
      const selected = answered.get(qid) ?? null;
      const correct = keyMap.get(qid) ?? null;
      responses[qid] = {
        selected,
        correct,
        isCorrect: selected && correct ? selected === correct : null,
      };
    }
    let sectionScores = mine.sectionScores
      ? (JSON.parse(mine.sectionScores) as AttemptScore['sections'])
      : [];
    if (restrictIds) {
      sectionScores = sectionScores.filter(s => restrictIds.includes(s.sectionId));
    }
    me = {
      attemptId: mine.id,
      mode: mine.mode,
      totalScore: mine.totalScore ?? 0,
      percentage: attemptedMarks > 0 ? round2(((mine.totalScore ?? 0) / attemptedMarks) * 100) : 0,
      totalCorrect: mine.totalCorrect ?? 0,
      totalWrong: mine.totalWrong ?? 0,
      totalUnattempted: mine.totalUnattempted ?? 0,
      rank: myRank.rank,
      percentile: myRank.percentile,
      sections: sectionScores,
      responses,
    };
  }

  const answerKey: Record<number, string | null> = {};
  for (const qid of allQuestionIds) answerKey[qid] = keyMap.get(qid) ?? null;

  return {
    test: {
      slug: test.slug,
      title: test.title,
      bucket: test.bucket,
      totalMarks: attemptedMarks,
      totalQuestions: test.totalQuestions,
    },
    me,
    classStats,
    questionAnalytics,
    sections,
    answerKey,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

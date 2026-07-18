/**
 * Data layer for the admin/instructor "Students Progress" feature.
 * See src/lib/students/progress-types.ts for the shared response contract.
 */

import { db } from '@/lib/db';
import {
  users, userAccess, classSessions, classAttendance,
  testAttempts, tests, vocabUserProgress, vocabQuizAnswers,
  vocabQuizSessions, vocabUserWordRecords,
} from '@/lib/db/schema';
import { and, eq, inArray, isNull, or, lte, desc, count } from 'drizzle-orm';
import { getTestResults } from '@/lib/tests/service';
import type {
  BatchListResponse, BatchOption, BatchSummaryResponse, StudentSummary,
  StudentSummaryLastTest, StudentDetailResponse, StudentProfile,
  StudentOverview, StudentTestResult, WeakSection, AttendanceBreakdown,
  AttendanceBySubject, AttendanceSession, LexicoreBreakdown,
} from './progress-types';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Batch list ────────────────────────────────────────────────────────────────

export async function listBatches(): Promise<BatchListResponse> {
  const rows = await db
    .select({ batch: users.batch })
    .from(users)
    .where(eq(users.role, 'student'));

  const counts = new Map<string, number>();
  for (const r of rows) {
    if (!r.batch) continue;
    counts.set(r.batch, (counts.get(r.batch) ?? 0) + 1);
  }

  const batches: BatchOption[] = Array.from(counts.entries())
    .map(([batch, studentCount]) => ({ batch, studentCount }))
    .sort((a, b) => a.batch.localeCompare(b.batch));

  let defaultBatch: string | null = null;
  let max = -1;
  for (const b of batches) {
    if (b.studentCount > max) { max = b.studentCount; defaultBatch = b.batch; }
  }

  return { batches, defaultBatch };
}

// ─── Batch summary (table of students in a batch) ──────────────────────────────

export async function getBatchSummaries(batch: string): Promise<BatchSummaryResponse> {
  const studentRows = await db.select().from(users)
    .where(and(eq(users.role, 'student'), eq(users.batch, batch)));
  if (studentRows.length === 0) return { batch, students: [] };

  const userIds = studentRows.map(u => u.id);

  const [accessRows, progressRows] = await Promise.all([
    db.select({ userId: userAccess.userId, product: userAccess.product })
      .from(userAccess)
      .where(and(inArray(userAccess.userId, userIds), eq(userAccess.active, true))),
    db.select().from(vocabUserProgress).where(inArray(vocabUserProgress.userId, userIds)),
  ]);

  const productsByUser = new Map<number, string[]>();
  const productSet = new Set<string>();
  for (const r of accessRows) {
    const list = productsByUser.get(r.userId) ?? [];
    list.push(r.product);
    productsByUser.set(r.userId, list);
    productSet.add(r.product);
  }

  const progressByUser = new Map(progressRows.map(p => [p.userId, p]));

  // Applicable completed sessions across every product present in this batch.
  const now = new Date();
  const batchCondition = or(isNull(classSessions.batch), eq(classSessions.batch, batch));
  const applicableSessions = productSet.size > 0
    ? await db.select({ id: classSessions.id, product: classSessions.product })
        .from(classSessions)
        .where(and(
          inArray(classSessions.product, Array.from(productSet)),
          eq(classSessions.status, 'completed'),
          lte(classSessions.scheduledAt, now),
          batchCondition,
        ))
    : [];

  const sessionsByProduct = new Map<string, { id: number; product: string }[]>();
  for (const s of applicableSessions) {
    const list = sessionsByProduct.get(s.product) ?? [];
    list.push(s);
    sessionsByProduct.set(s.product, list);
  }

  const sessionIds = applicableSessions.map(s => s.id);
  const attendanceRows = sessionIds.length
    ? await db.select({ userId: classAttendance.userId, sessionId: classAttendance.sessionId })
        .from(classAttendance)
        .where(and(inArray(classAttendance.sessionId, sessionIds), inArray(classAttendance.userId, userIds)))
    : [];
  const attendedByUser = new Map<number, Set<number>>();
  for (const row of attendanceRows) {
    if (!attendedByUser.has(row.userId)) attendedByUser.set(row.userId, new Set());
    attendedByUser.get(row.userId)!.add(row.sessionId);
  }

  // Last submitted test per user.
  const submittedAttempts = await db.select().from(testAttempts)
    .where(and(inArray(testAttempts.userId, userIds), eq(testAttempts.status, 'submitted')));
  const testIds = Array.from(new Set(submittedAttempts.map(a => a.testId)));
  const testRows = testIds.length ? await db.select().from(tests).where(inArray(tests.id, testIds)) : [];
  const testById = new Map(testRows.map(t => [t.id, t]));

  const lastAttemptByUser = new Map<number, typeof submittedAttempts[number]>();
  for (const a of submittedAttempts) {
    if (!a.submittedAt) continue;
    const existing = lastAttemptByUser.get(a.userId);
    if (!existing || !existing.submittedAt || a.submittedAt > existing.submittedAt) {
      lastAttemptByUser.set(a.userId, a);
    }
  }

  const students: StudentSummary[] = studentRows.map(u => {
    const products = productsByUser.get(u.id) ?? [];
    const userSessions = products.flatMap(p => sessionsByProduct.get(p) ?? []);
    const attendedSet = attendedByUser.get(u.id) ?? new Set<number>();
    const attendedSessions = userSessions.filter(s => attendedSet.has(s.id)).length;
    const totalSessions = userSessions.length;
    const attendancePercent = totalSessions > 0
      ? round2((attendedSessions / totalSessions) * 100)
      : null;

    const attempt = lastAttemptByUser.get(u.id);
    let lastTest: StudentSummaryLastTest | null = null;
    if (attempt && attempt.submittedAt) {
      const test = testById.get(attempt.testId);
      if (test) {
        const score = attempt.totalScore ?? 0;
        lastTest = {
          testId: test.id,
          title: test.title,
          takenAt: attempt.submittedAt.toISOString(),
          score,
          totalMarks: test.totalMarks,
          percentage: test.totalMarks > 0 ? round2((score / test.totalMarks) * 100) : 0,
        };
      }
    }

    const progress = progressByUser.get(u.id);

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      studentId: u.studentId,
      products,
      attendancePercent,
      attendedSessions,
      totalSessions,
      lastTest,
      lexicorePoints: progress?.totalPoints ?? 0,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  return { batch, students };
}

// ─── Student detail (per-student deep-dive) ────────────────────────────────────

export async function getStudentDetail(userId: number): Promise<StudentDetailResponse | null> {
  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user || user.role !== 'student') return null;

  const accessRows = await db.select({ product: userAccess.product })
    .from(userAccess)
    .where(and(eq(userAccess.userId, userId), eq(userAccess.active, true)));
  const products = accessRows.map(r => r.product);

  const profile: StudentProfile = {
    id: user.id,
    name: user.name,
    email: user.email,
    studentId: user.studentId,
    batch: user.batch,
    products,
    role: user.role,
    status: user.status,
    joinedAt: user.createdAt.toISOString(),
  };

  // ── Tests (newest first) ──
  const submittedAttempts = await db.select().from(testAttempts)
    .where(and(eq(testAttempts.userId, userId), eq(testAttempts.status, 'submitted')))
    .orderBy(desc(testAttempts.submittedAt));

  const testIds = submittedAttempts.map(a => a.testId);
  const testRows = testIds.length ? await db.select().from(tests).where(inArray(tests.id, testIds)) : [];
  const testById = new Map(testRows.map(t => [t.id, t]));

  const testResults: StudentTestResult[] = [];
  for (const attempt of submittedAttempts) {
    const test = testById.get(attempt.testId);
    if (!test || !attempt.submittedAt) continue;
    const results = await getTestResults(test.id, userId);
    const me = results?.me;
    if (!me) continue;

    testResults.push({
      testId: test.id,
      slug: test.slug,
      title: test.title,
      takenAt: attempt.submittedAt.toISOString(),
      mode: attempt.mode,
      score: me.totalScore,
      totalMarks: test.totalMarks,
      percentage: me.percentage,
      rank: me.rank,
      totalStudents: results.classStats.totalStudents,
      classAverage: results.classStats.averageScore,
      top5Average: results.classStats.top5Average,
      highest: results.classStats.highest,
      totalCorrect: me.totalCorrect,
      totalWrong: me.totalWrong,
      totalUnattempted: me.totalUnattempted,
      sections: me.sections.map(s => ({
        title: s.title,
        score: s.score,
        totalMarks: s.maxScore,
        percentage: s.percentage,
        correct: s.correct,
        wrong: s.wrong,
        unattempted: s.unattempted,
      })),
    });
  }

  // ── Weak sections (aggregate across all tests by title) ──
  const sectionAgg = new Map<string, { correct: number; wrong: number; testsCount: number }>();
  for (const t of testResults) {
    for (const s of t.sections) {
      const agg = sectionAgg.get(s.title) ?? { correct: 0, wrong: 0, testsCount: 0 };
      agg.correct += s.correct;
      agg.wrong += s.wrong;
      agg.testsCount += 1;
      sectionAgg.set(s.title, agg);
    }
  }
  const weakSections: WeakSection[] = Array.from(sectionAgg.entries())
    .map(([title, agg]) => ({
      title,
      accuracyPercent: (agg.correct + agg.wrong) > 0
        ? round2((agg.correct / (agg.correct + agg.wrong)) * 100)
        : 0,
      correct: agg.correct,
      wrong: agg.wrong,
      testsCount: agg.testsCount,
    }))
    .filter(s => (s.correct + s.wrong) > 0)
    .sort((a, b) => a.accuracyPercent - b.accuracyPercent)
    .slice(0, 5);

  // ── Attendance ──
  const now = new Date();
  const batchCondition = user.batch !== null
    ? or(isNull(classSessions.batch), eq(classSessions.batch, user.batch))
    : isNull(classSessions.batch);

  const applicableSessions = products.length
    ? await db.select().from(classSessions)
        .where(and(
          inArray(classSessions.product, products),
          eq(classSessions.status, 'completed'),
          lte(classSessions.scheduledAt, now),
          batchCondition,
        ))
    : [];

  const sessionIds = applicableSessions.map(s => s.id);
  const attendanceRows = sessionIds.length
    ? await db.select().from(classAttendance)
        .where(and(inArray(classAttendance.sessionId, sessionIds), eq(classAttendance.userId, userId)))
    : [];
  const attendanceBySession = new Map(attendanceRows.map(r => [r.sessionId, r]));

  const attended = applicableSessions.filter(s => attendanceBySession.has(s.id)).length;
  const total = applicableSessions.length;
  const overallPercent = total > 0 ? round2((attended / total) * 100) : null;

  const bySubjectMap = new Map<string, { attended: number; total: number }>();
  for (const s of applicableSessions) {
    const agg = bySubjectMap.get(s.subject) ?? { attended: 0, total: 0 };
    agg.total += 1;
    if (attendanceBySession.has(s.id)) agg.attended += 1;
    bySubjectMap.set(s.subject, agg);
  }
  const bySubject: AttendanceBySubject[] = Array.from(bySubjectMap.entries())
    .map(([subject, agg]) => ({
      subject,
      attended: agg.attended,
      total: agg.total,
      percent: agg.total > 0 ? round2((agg.attended / agg.total) * 100) : null,
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject));

  const recent: AttendanceSession[] = [...applicableSessions]
    .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime())
    .slice(0, 15)
    .map(s => {
      const att = attendanceBySession.get(s.id);
      return {
        sessionId: s.id,
        title: s.title,
        subject: s.subject,
        scheduledAt: s.scheduledAt.toISOString(),
        attended: !!att,
        mode: att ? att.mode : null,
      };
    });

  const attendance: AttendanceBreakdown = { overallPercent, attended, total, bySubject, recent };

  // ── LexiCore ──
  const progress = await db.select().from(vocabUserProgress)
    .where(eq(vocabUserProgress.userId, userId)).get();

  const quizAnswers = await db.select().from(vocabQuizAnswers)
    .where(eq(vocabQuizAnswers.userId, userId));
  const quizPoints = quizAnswers.reduce((sum, a) => sum + a.pointsEarned, 0);
  const quizCorrect = quizAnswers.filter(a => a.isCorrect).length;
  const quizAccuracy = quizAnswers.length > 0
    ? round2((quizCorrect / quizAnswers.length) * 100)
    : null;

  const [quizSessionsRow] = await db.select({ total: count() }).from(vocabQuizSessions)
    .where(and(eq(vocabQuizSessions.userId, userId), eq(vocabQuizSessions.status, 'complete')));
  const quizzesCompleted = quizSessionsRow?.total ?? 0;

  const [wordsMasteredRow] = await db.select({ total: count() }).from(vocabUserWordRecords)
    .where(and(eq(vocabUserWordRecords.userId, userId), eq(vocabUserWordRecords.masteryLevel, 'mastered')));
  const wordsMastered = wordsMasteredRow?.total ?? 0;

  const [wordsSeenRow] = await db.select({ total: count() }).from(vocabUserWordRecords)
    .where(eq(vocabUserWordRecords.userId, userId));
  const wordsSeen = wordsSeenRow?.total ?? 0;

  const totalPoints = progress?.totalPoints ?? 0;
  const wordPoints = Math.max(0, totalPoints - quizPoints);

  const lexicore: LexicoreBreakdown = {
    totalPoints,
    quizPoints,
    wordPoints,
    quizzesCompleted,
    quizAccuracy,
    wordsMastered,
    wordsSeen,
    streakDays: progress?.streakDays ?? 0,
    longestStreak: progress?.longestStreak ?? 0,
    weeklyPoints: progress?.weeklyPoints ?? 0,
    hasProgress: !!progress,
  };

  // ── Overview KPI strip ──
  const avgTestPercentage = testResults.length > 0
    ? round2(testResults.reduce((sum, t) => sum + t.percentage, 0) / testResults.length)
    : null;
  const bestRank = testResults.length > 0
    ? Math.min(...testResults.map(t => t.rank))
    : null;

  const overview: StudentOverview = {
    attendancePercent: overallPercent,
    attendedSessions: attended,
    totalSessions: total,
    testsTaken: testResults.length,
    avgTestPercentage,
    bestRank,
    lexicorePoints: totalPoints,
    wordsMastered,
    streakDays: progress?.streakDays ?? 0,
  };

  return { profile, overview, tests: testResults, weakSections, attendance, lexicore };
}

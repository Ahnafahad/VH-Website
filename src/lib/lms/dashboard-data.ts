/**
 * LMS Dashboard aggregate query — used by both the API route and (later)
 * the /dashboard server component directly.
 *
 * Parallelises independent queries with Promise.all.
 * All timestamps are Date objects (Drizzle mode:'timestamp').
 */

import { db } from '@/lib/db';
import {
  classSessions,
  classAttendance,
  materials,
  recordings,
  recordingWatchProgress,
  assignments,
  assignmentSubmissions,
  tests,
  testWindows,
  testAttempts,
  lmsAnnouncements,
  vocabUserProgress,
  vocabUserWordRecords,
  mathUserProgress,
  accountingProgress,
} from '@/lib/db/schema';
import type { UserWithProducts } from '@/lib/db/schema';
import {
  and,
  desc,
  eq,
  gte,
  lte,
  or,
  inArray,
  asc,
  count,
} from 'drizzle-orm';
import { lmsScopeConditions } from './access';
import { isJoinOpen } from './join-window';
import { resolveFileUrl } from '@/lib/storage/r2';
import { canAccessTest } from '@/lib/tests/access';
import { effectiveWindowState, type EffectiveWindowState } from '@/lib/tests/windows';
import { computeRanks } from '@/lib/tests/scoring';
import { SUBJECTS } from './subject-data';
import type { LmsSubject } from '@/lib/db/schema';

// ─── Return shape ─────────────────────────────────────────────────────────────

export interface DashboardLastClass {
  id: number;
  title: string;
  subject: string;
  scheduledAt: number; // epoch ms
  durationMinutes: number;
  status: string;
  materials: Array<{
    id: number;
    title: string;
    type: string;
    blobUrl: string;
    fileName: string | null;
  }>;
  recording: { status: string } | null;
}

export interface DashboardNextClass {
  id: number;
  title: string;
  subject: string;
  scheduledAt: number; // epoch ms
  durationMinutes: number;
  status: string;
  joinOpen: boolean;
  meetLink: string | null; // only if joinOpen
}

export interface DashboardWeekClass {
  id: number;
  title: string;
  subject: string;
  scheduledAt: number; // epoch ms
  durationMinutes: number;
  status: string;
}

export interface DashboardAssignment {
  id: number;
  title: string;
  description: string;
  subject: string;
  dueAt: number; // epoch ms
  classSessionId: number | null;
  mySubmission: { status: string } | 'pending';
}

export interface DashboardUpcomingTest {
  id: number;
  slug: string;
  title: string;
  bucket: string;
  syllabus: string | null;
  windows: Array<{
    id: number;
    mode: string;
    opensAt: number;
    closesAt: number;
    durationMinutes: number | null;
    state: EffectiveWindowState;
  }>;
  myAttempt: { status: string } | null;
}

export interface DashboardAnnouncement {
  id: number;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: number; // epoch ms
}

// ─── New interfaces ────────────────────────────────────────────────────────────

/**
 * One section's score as serialized into testAttempts.sectionScores (JSON).
 * The stored JSON is an array of SectionScore from src/lib/tests/scoring.ts.
 * Fields available after parsing:
 *   sectionId, title, correct, wrong, unattempted, totalQuestions,
 *   score, maxScore, percentage, thresholdPercent, passed
 */
export interface DashboardSectionScore {
  title: string;
  score: number;
  maxScore: number;
  correct: number;
  wrong: number;
}

export interface DashboardResultEntry {
  testId: number;
  slug: string;
  title: string;
  bucket: string;
  totalScore: number;
  totalMarks: number;
  percentage: number;
  rank: number;
  totalStudents: number;
  percentile: number;
  submittedAt: number; // epoch ms
}

export interface DashboardResults {
  /** Most recent submitted attempt, with per-section breakdown. */
  latest: (DashboardResultEntry & {
    sections: DashboardSectionScore[];
  }) | null;
  /** ≤5 newest submitted attempts, newest first. Includes latest. */
  history: DashboardResultEntry[];
}

export interface DashboardRecentClass {
  id: number;
  title: string;
  subject: string;
  scheduledAt: number; // epoch ms
  /** Materials populated only for the newest class; [] for all others. */
  materials: Array<{ id: number; title: string; type: string }>;
  recording: { status: string } | null;
  watch: { completedPercent: number; lastPositionSeconds: number } | null;
}

export interface DashboardClassPulse {
  /** 0–100 rounded, null when completedCount === 0 (no completed classes to measure against). */
  attendanceRate: number | null;
  attendedCount: number;
  completedCount: number;
  /** ≤5 completed classes, newest first. */
  recentClasses: DashboardRecentClass[];
  /** First available recording not yet fully watched (completedPercent < 90), for resume CTA. */
  resumeTarget: { sessionId: number; title: string; completedPercent: number } | null;
}

export interface DashboardGames {
  vocab: { totalPoints: number; streakDays: number; masteredCount: number; totalTracked: number } | null;
  math: { bestScore: number; overallAccuracy: number; totalGames: number } | null;
  accounting: { totalMastered: number; totalQuestions: number } | null;
}

export interface DashboardMomentum {
  /** Vocab streak (games.vocab?.streakDays ?? 0). */
  streakDays: number;
  /** Assignments with mySubmission === 'pending' and dueAt >= now. */
  homeworkDue: number;
  /** Upcoming tests with at least one 'open' window where user has not submitted. */
  testsOpenNow: number;
  /** Recent completed classes where recording is available but not yet watched to ≥90%. */
  unwatchedRecordings: number;
}

export interface DashboardSubjectSummary {
  subject: LmsSubject;
  /** Not-yet-submitted assignments due now or later, for this subject. */
  pendingHomeworkCount: number;
  /** Lecture-sheet (PDF material) count for this subject, in scope. */
  lectureSheetCount: number;
}

export interface DashboardData {
  hasAccess: true;
  lastClass: DashboardLastClass | null;
  nextClass: DashboardNextClass | null;
  weekClasses: DashboardWeekClass[];
  assignments: DashboardAssignment[];
  upcomingTests: DashboardUpcomingTest[];
  announcements: DashboardAnnouncement[];
  results: DashboardResults;
  classPulse: DashboardClassPulse;
  games: DashboardGames;
  momentum: DashboardMomentum;
  subjects: DashboardSubjectSummary[];
}

// ─── Local helpers ─────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Helper: is LMS staff ─────────────────────────────────────────────────────

function isLmsStaff(user: UserWithProducts): boolean {
  return (
    user.role === 'admin' ||
    user.role === 'super_admin' ||
    user.role === 'instructor'
  );
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function getDashboardData(
  user: UserWithProducts,
): Promise<DashboardData | { hasAccess: false }> {
  const staff = isLmsStaff(user);

  // Students need at least one LMS product (iba/fbs)
  if (!staff && user.products.length === 0) {
    return { hasAccess: false };
  }

  const now = new Date();

  // Scope conditions for session queries (staff = no extra filter)
  const sessionScope = lmsScopeConditions(user, classSessions);

  // ─── Parallel batch 1: last class + next class + week classes + assignments + announcements
  const weekAgo = new Date(now.getTime() - 7 * 86400_000);
  const weekAhead = new Date(now.getTime() + 7 * 86400_000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400_000);

  const [
    lastClassRows,
    nextClassRows,
    weekClassRows,
    rawAssignments,
    announcementRows,
    publishedTests,
    lectureSheetCountRows,
  ] = await Promise.all([
    // Last completed class in scope
    db
      .select()
      .from(classSessions)
      .where(
        and(
          eq(classSessions.status, 'completed'),
          ...sessionScope,
        ),
      )
      .orderBy(desc(classSessions.scheduledAt))
      .limit(1),

    // Next scheduled class in scope
    db
      .select()
      .from(classSessions)
      .where(
        and(
          eq(classSessions.status, 'scheduled'),
          gte(classSessions.scheduledAt, now),
          ...sessionScope,
        ),
      )
      .orderBy(asc(classSessions.scheduledAt))
      .limit(1),

    // Week classes (±7 days), scheduled or completed
    db
      .select()
      .from(classSessions)
      .where(
        and(
          or(
            eq(classSessions.status, 'scheduled'),
            eq(classSessions.status, 'completed'),
            eq(classSessions.status, 'live'),
          ),
          gte(classSessions.scheduledAt, weekAgo),
          lte(classSessions.scheduledAt, weekAhead),
          ...sessionScope,
        ),
      )
      .orderBy(asc(classSessions.scheduledAt)),

    // Assignments with dueAt >= now-7d
    db
      .select()
      .from(assignments)
      .where(
        and(
          gte(assignments.dueAt, sevenDaysAgo),
          ...lmsScopeConditions(user, assignments),
        ),
      )
      .orderBy(asc(assignments.dueAt)),

    // Latest 10 announcements in scope, pinned first
    db
      .select()
      .from(lmsAnnouncements)
      .where(and(...lmsScopeConditions(user, lmsAnnouncements)))
      .orderBy(desc(lmsAnnouncements.pinned), desc(lmsAnnouncements.createdAt))
      .limit(10),

    // All published tests (we'll filter by user products below)
    db
      .select()
      .from(tests)
      .where(eq(tests.status, 'published')),

    // Lecture-sheet (pdf material) count grouped by subject, in scope
    db
      .select({ subject: materials.subject, value: count() })
      .from(materials)
      .where(and(eq(materials.type, 'pdf'), ...lmsScopeConditions(user, materials)))
      .groupBy(materials.subject),
  ]);

  // ─── Materials + recording for lastClass ─────────────────────────────────────
  const lastClass = lastClassRows[0] ?? null;
  const nextClassRaw = nextClassRows[0] ?? null;

  let lastClassMaterials: DashboardLastClass['materials'] = [];
  let lastClassRecording: { status: string } | null = null;

  if (lastClass) {
    const [mats, recs] = await Promise.all([
      db
        .select()
        .from(materials)
        .where(
          and(
            eq(materials.classSessionId, lastClass.id),
            ...lmsScopeConditions(user, materials),
          ),
        ),
      db
        .select({ status: recordings.status })
        .from(recordings)
        .where(eq(recordings.classSessionId, lastClass.id))
        .limit(1),
    ]);
    lastClassMaterials = await Promise.all(
      mats.map(async (m) => ({
        id: m.id,
        title: m.title,
        type: m.type,
        blobUrl: (await resolveFileUrl(m.blobUrl)) ?? '',
        fileName: m.fileName,
      })),
    );
    lastClassRecording = recs[0] ?? null;
  }

  // ─── My submissions for assignments ──────────────────────────────────────────
  const assignmentIds = rawAssignments.map((a) => a.id);
  const mySubmissions =
    assignmentIds.length > 0
      ? await db
          .select()
          .from(assignmentSubmissions)
          .where(
            and(
              inArray(assignmentSubmissions.assignmentId, assignmentIds),
              eq(assignmentSubmissions.userId, user.id),
            ),
          )
      : [];

  const subMap = new Map(mySubmissions.map((s) => [s.assignmentId, s.status]));

  // ─── Upcoming tests ───────────────────────────────────────────────────────────
  // Filter by user products (staff bypass), then check windows not all closed
  const accessibleTests = publishedTests.filter((t) =>
    canAccessTest(user, t),
  );
  const testIds = accessibleTests.map((t) => t.id);

  let upcomingTests: DashboardUpcomingTest[] = [];

  if (testIds.length > 0) {
    const [allWindows, myAttempts] = await Promise.all([
      db
        .select()
        .from(testWindows)
        .where(inArray(testWindows.testId, testIds)),
      db
        .select()
        .from(testAttempts)
        .where(
          and(
            inArray(testAttempts.testId, testIds),
            eq(testAttempts.userId, user.id),
          ),
        ),
    ]);

    const attemptMap = new Map(myAttempts.map((a) => [a.testId, a]));

    upcomingTests = accessibleTests
      .map((t) => {
        const tWindows = allWindows.filter((w) => w.testId === t.id);
        // Only include tests with at least one non-closed window
        const hasOpen = tWindows.some(
          (w) => effectiveWindowState(w, now) !== 'closed',
        );
        if (!hasOpen) return null;

        const attempt = attemptMap.get(t.id);
        return {
          id: t.id,
          slug: t.slug,
          title: t.title,
          bucket: t.bucket,
          syllabus: t.syllabus,
          windows: tWindows
            .sort((a, b) => a.opensAt.getTime() - b.opensAt.getTime())
            .map((w) => ({
              id: w.id,
              mode: w.mode,
              opensAt: w.opensAt.getTime(),
              closesAt: w.closesAt.getTime(),
              durationMinutes: w.durationMinutes,
              state: effectiveWindowState(w, now),
            })),
          myAttempt: attempt
            ? { status: attempt.status }
            : null,
        };
      })
      .filter((t) => t !== null) as DashboardUpcomingTest[];
  }

  // ─── Batch 2a: results — my submitted attempts for results-published tests ────
  // Filter publishedTests to those with resultsPublishedAt set AND accessible
  const resultsEligibleTests = publishedTests.filter(
    (t) => t.resultsPublishedAt !== null && canAccessTest(user, t),
  );
  const resultsEligibleIds = resultsEligibleTests.map((t) => t.id);

  // My submitted attempts for those tests, newest first, limit 5
  const mySubmittedAttempts =
    resultsEligibleIds.length > 0
      ? await db
          .select()
          .from(testAttempts)
          .where(
            and(
              inArray(testAttempts.testId, resultsEligibleIds),
              eq(testAttempts.userId, user.id),
              eq(testAttempts.status, 'submitted'),
            ),
          )
          .orderBy(desc(testAttempts.submittedAt))
          .limit(5)
      : [];

  // Rank data: all submitted attempts for the ≤5 test ids my user attempted
  const myAttemptedTestIds = [...new Set(mySubmittedAttempts.map((a) => a.testId))];

  const allSubmittedForRank =
    myAttemptedTestIds.length > 0
      ? await db
          .select({
            id: testAttempts.id,
            testId: testAttempts.testId,
            totalScore: testAttempts.totalScore,
          })
          .from(testAttempts)
          .where(
            and(
              inArray(testAttempts.testId, myAttemptedTestIds),
              eq(testAttempts.status, 'submitted'),
            ),
          )
      : [];

  // Group by testId and compute ranks in JS
  const ranksByTestId = new Map<number, ReturnType<typeof computeRanks>>();
  for (const testId of myAttemptedTestIds) {
    const entries = allSubmittedForRank
      .filter((a) => a.testId === testId)
      .map((a) => ({ attemptId: a.id, totalScore: a.totalScore ?? 0 }));
    ranksByTestId.set(testId, computeRanks(entries));
  }

  // Total students per test (for the ≤5 tests)
  const totalStudentsByTestId = new Map<number, number>();
  for (const testId of myAttemptedTestIds) {
    const entries = allSubmittedForRank.filter((a) => a.testId === testId);
    totalStudentsByTestId.set(testId, entries.length);
  }

  // Build testMap for slug/title/bucket/totalMarks
  const resultTestMap = new Map(
    resultsEligibleTests.map((t) => [t.id, t]),
  );

  function buildResultEntry(attempt: typeof mySubmittedAttempts[number]): DashboardResultEntry {
    const t = resultTestMap.get(attempt.testId)!;
    const ranks = ranksByTestId.get(attempt.testId) ?? [];
    const myRank = ranks.find((r) => r.attemptId === attempt.id);
    const totalStudents = totalStudentsByTestId.get(attempt.testId) ?? 1;
    const totalScore = attempt.totalScore ?? 0;
    const totalMarks = t.totalMarks;
    return {
      testId: t.id,
      slug: t.slug,
      title: t.title,
      bucket: t.bucket,
      totalScore,
      totalMarks,
      percentage: totalMarks > 0 ? round2((totalScore / totalMarks) * 100) : 0,
      rank: myRank?.rank ?? totalStudents,
      totalStudents,
      percentile: myRank?.percentile ?? 0,
      submittedAt: attempt.submittedAt?.getTime() ?? 0,
    };
  }

  const resultHistory: DashboardResultEntry[] = mySubmittedAttempts.map(buildResultEntry);

  // Latest entry with sections parsed from sectionScores JSON
  let resultLatest: DashboardResults['latest'] = null;
  if (mySubmittedAttempts.length > 0) {
    const latestAttempt = mySubmittedAttempts[0];
    const base = buildResultEntry(latestAttempt);
    let sections: DashboardSectionScore[] = [];
    if (latestAttempt.sectionScores) {
      try {
        // sectionScores is stored as JSON array of SectionScore (from scoring.ts)
        const parsed = JSON.parse(latestAttempt.sectionScores) as Array<{
          title?: string;
          score?: number;
          maxScore?: number;
          correct?: number;
          wrong?: number;
        }>;
        if (Array.isArray(parsed)) {
          sections = parsed.map((s) => ({
            title: s.title ?? '',
            score: s.score ?? 0,
            maxScore: s.maxScore ?? 0,
            correct: s.correct ?? 0,
            wrong: s.wrong ?? 0,
          }));
        }
      } catch {
        // malformed JSON — leave sections as []
      }
    }
    resultLatest = { ...base, sections };
  }

  const dashResults: DashboardResults = {
    latest: resultLatest,
    history: resultHistory,
  };

  // ─── Batch 2b: classPulse — completed sessions in scope ───────────────────────
  const completedSessionRows = await db
    .select({
      id: classSessions.id,
      title: classSessions.title,
      subject: classSessions.subject,
      scheduledAt: classSessions.scheduledAt,
    })
    .from(classSessions)
    .where(
      and(
        eq(classSessions.status, 'completed'),
        ...sessionScope,
      ),
    )
    .orderBy(desc(classSessions.scheduledAt));

  const completedSessionIds = completedSessionRows.map((s) => s.id);
  const top5Sessions = completedSessionRows.slice(0, 5);
  const top5Ids = top5Sessions.map((s) => s.id);

  // Parallel: attendance, recordings for top5, watch progress for those recordings, materials for newest
  const newestId = top5Ids[0] ?? null;

  const [
    myAttendanceRows,
    top5Recordings,
    newestMaterials,
    vocabProgressRow,
    mathProgressRow,
    accountingProgressRow,
    masteredVocabCount,
    totalVocabTracked,
  ] = await Promise.all([
    // My attendance records — intersect with completed set in JS
    completedSessionIds.length > 0
      ? db
          .select({ sessionId: classAttendance.sessionId })
          .from(classAttendance)
          .where(eq(classAttendance.userId, user.id))
      : Promise.resolve([] as Array<{ sessionId: number }>),

    // Recordings for the top 5 sessions
    top5Ids.length > 0
      ? db
          .select({
            id: recordings.id,
            classSessionId: recordings.classSessionId,
            status: recordings.status,
          })
          .from(recordings)
          .where(inArray(recordings.classSessionId, top5Ids))
      : Promise.resolve([] as Array<{ id: number; classSessionId: number; status: string }>),

    // Materials for the newest completed session only
    newestId !== null
      ? db
          .select({
            id: materials.id,
            title: materials.title,
            type: materials.type,
          })
          .from(materials)
          .where(
            and(
              eq(materials.classSessionId, newestId),
              ...lmsScopeConditions(user, materials),
            ),
          )
      : Promise.resolve([] as Array<{ id: number; title: string; type: string }>),

    // Vocab user progress
    db
      .select()
      .from(vocabUserProgress)
      .where(eq(vocabUserProgress.userId, user.id))
      .limit(1),

    // Math user progress
    db
      .select()
      .from(mathUserProgress)
      .where(eq(mathUserProgress.userId, user.id))
      .limit(1),

    // Accounting progress (keyed by email)
    db
      .select()
      .from(accountingProgress)
      .where(eq(accountingProgress.playerEmail, user.email))
      .limit(1),

    // Mastered vocab word count ('strong' | 'mastered')
    db
      .select({ value: count() })
      .from(vocabUserWordRecords)
      .where(
        and(
          eq(vocabUserWordRecords.userId, user.id),
          inArray(vocabUserWordRecords.masteryLevel, ['strong', 'mastered']),
        ),
      ),

    // Total tracked vocab words for user
    db
      .select({ value: count() })
      .from(vocabUserWordRecords)
      .where(eq(vocabUserWordRecords.userId, user.id)),
  ]);

  // Recording watch progress for the recording ids in top5
  const top5RecordingIds = top5Recordings.map((r) => r.id);
  const myWatchRows =
    top5RecordingIds.length > 0
      ? await db
          .select()
          .from(recordingWatchProgress)
          .where(
            and(
              inArray(recordingWatchProgress.recordingId, top5RecordingIds),
              eq(recordingWatchProgress.userId, user.id),
            ),
          )
      : [];

  // Build classPulse
  const completedSet = new Set(completedSessionIds);
  const attendedSessionIds = new Set(
    myAttendanceRows.map((r) => r.sessionId).filter((id) => completedSet.has(id)),
  );
  const attendedCount = attendedSessionIds.size;
  const completedCount = completedSessionRows.length;
  const attendanceRate =
    completedCount === 0
      ? null
      : Math.round((attendedCount / completedCount) * 100);

  // Maps for O(1) lookup
  const recordingBySessionId = new Map(
    top5Recordings.map((r) => [r.classSessionId, r]),
  );
  const watchByRecordingId = new Map(
    myWatchRows.map((w) => [w.recordingId, w]),
  );

  const recentClasses: DashboardRecentClass[] = top5Sessions.map((s, idx) => {
    const rec = recordingBySessionId.get(s.id) ?? null;
    const watch = rec ? (watchByRecordingId.get(rec.id) ?? null) : null;
    return {
      id: s.id,
      title: s.title,
      subject: s.subject,
      scheduledAt: s.scheduledAt.getTime(),
      // Materials only for the newest (index 0)
      materials: idx === 0 ? newestMaterials : [],
      recording: rec ? { status: rec.status } : null,
      watch: watch
        ? {
            completedPercent: watch.completedPercent,
            lastPositionSeconds: watch.lastPositionSeconds,
          }
        : null,
    };
  });

  // resumeTarget: first class (newest-first) with available recording and partial watch
  const resumeTarget = (() => {
    for (const rc of recentClasses) {
      if (
        rc.recording?.status === 'available' &&
        rc.watch !== null &&
        rc.watch.completedPercent > 0 &&
        rc.watch.completedPercent < 90
      ) {
        return {
          sessionId: rc.id,
          title: rc.title,
          completedPercent: rc.watch.completedPercent,
        };
      }
    }
    return null;
  })();

  const dashClassPulse: DashboardClassPulse = {
    attendanceRate,
    attendedCount,
    completedCount,
    recentClasses,
    resumeTarget,
  };

  // ─── Games ────────────────────────────────────────────────────────────────────
  const vocabProg = vocabProgressRow[0] ?? null;
  const mathProg = mathProgressRow[0] ?? null;
  const accProg = accountingProgressRow[0] ?? null;

  const dashGames: DashboardGames = {
    vocab: vocabProg
      ? {
          totalPoints: vocabProg.totalPoints,
          streakDays: vocabProg.streakDays,
          masteredCount: masteredVocabCount[0]?.value ?? 0,
          totalTracked: totalVocabTracked[0]?.value ?? 0,
        }
      : null,
    math: mathProg
      ? {
          bestScore: mathProg.bestScore,
          overallAccuracy: mathProg.overallAccuracy,
          totalGames: mathProg.totalGames,
        }
      : null,
    accounting: accProg
      ? {
          totalMastered: accProg.totalMastered,
          totalQuestions: accProg.totalQuestions,
        }
      : null,
  };

  // ─── Momentum (computed from assembled data) ───────────────────────────────────
  const nowMs = now.getTime();

  const homeworkDue = rawAssignments.filter((a) => {
    const submission = subMap.has(a.id) ? { status: subMap.get(a.id)! } : 'pending';
    return submission === 'pending' && a.dueAt.getTime() >= nowMs;
  }).length;

  // ─── Per-subject summary (for the subject-hub buttons) ───────────────────────
  const lectureSheetCountBySubject = new Map(
    lectureSheetCountRows.map((r) => [r.subject, r.value]),
  );
  const dashSubjects: DashboardSubjectSummary[] = SUBJECTS.map((subject) => ({
    subject,
    pendingHomeworkCount: rawAssignments.filter((a) => {
      const submission = subMap.has(a.id) ? { status: subMap.get(a.id)! } : 'pending';
      return a.subject === subject && submission === 'pending' && a.dueAt.getTime() >= nowMs;
    }).length,
    lectureSheetCount: lectureSheetCountBySubject.get(subject) ?? 0,
  }));

  const testsOpenNow = upcomingTests.filter((t) => {
    const hasOpenWindow = t.windows.some((w) => w.state === 'open');
    const notSubmitted =
      t.myAttempt === null || t.myAttempt.status !== 'submitted';
    return hasOpenWindow && notSubmitted;
  }).length;

  const unwatchedRecordings = recentClasses.filter(
    (rc) =>
      rc.recording?.status === 'available' &&
      (rc.watch === null || rc.watch.completedPercent < 90),
  ).length;

  const dashMomentum: DashboardMomentum = {
    streakDays: dashGames.vocab?.streakDays ?? 0,
    homeworkDue,
    testsOpenNow,
    unwatchedRecordings,
  };

  // ─── Assemble response ────────────────────────────────────────────────────────

  const dashLastClass: DashboardLastClass | null = lastClass
    ? {
        id: lastClass.id,
        title: lastClass.title,
        subject: lastClass.subject,
        scheduledAt: lastClass.scheduledAt.getTime(),
        durationMinutes: lastClass.durationMinutes,
        status: lastClass.status,
        materials: lastClassMaterials,
        recording: lastClassRecording,
      }
    : null;

  let dashNextClass: DashboardNextClass | null = null;
  if (nextClassRaw) {
    const joinOpen = isJoinOpen(
      {
        scheduledAt: nextClassRaw.scheduledAt,
        durationMinutes: nextClassRaw.durationMinutes,
      },
      now,
    );
    dashNextClass = {
      id: nextClassRaw.id,
      title: nextClassRaw.title,
      subject: nextClassRaw.subject,
      scheduledAt: nextClassRaw.scheduledAt.getTime(),
      durationMinutes: nextClassRaw.durationMinutes,
      status: nextClassRaw.status,
      joinOpen,
      meetLink: joinOpen ? nextClassRaw.meetLink : null,
    };
  }

  return {
    hasAccess: true,
    lastClass: dashLastClass,
    nextClass: dashNextClass,
    weekClasses: weekClassRows.map((s) => ({
      id: s.id,
      title: s.title,
      subject: s.subject,
      scheduledAt: s.scheduledAt.getTime(),
      durationMinutes: s.durationMinutes,
      status: s.status,
    })),
    assignments: rawAssignments.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      subject: a.subject,
      dueAt: a.dueAt.getTime(),
      classSessionId: a.classSessionId,
      mySubmission: subMap.has(a.id)
        ? { status: subMap.get(a.id)! }
        : 'pending',
    })),
    upcomingTests,
    announcements: announcementRows.map((an) => ({
      id: an.id,
      title: an.title,
      body: an.body,
      pinned: an.pinned,
      createdAt: an.createdAt.getTime(),
    })),
    results: dashResults,
    classPulse: dashClassPulse,
    games: dashGames,
    momentum: dashMomentum,
    subjects: dashSubjects,
  };
}

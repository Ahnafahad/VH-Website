/**
 * Per-student overrides. Only mechanisms that already exist in the data model are used:
 *  - test reopen / extend: a one-off test_windows row (status 'open', no per-user duration) that ONLY this
 *    attempt is re-pointed to. attemptDeadline() then resolves to that row's closesAt. Caveat: windows are per-test,
 *    so for the (short, minutes-long) lifetime of that row other not-yet-started students could see it as open.
 *  - recording unlock: a recording_access_grants row for the one user (what the staff grant route writes).
 *  - sprint / marathon reset: delete the single attempt (answers first); the full before-state goes to audit_log.
 * Marathon "unlock a day early" has no per-student mechanism (unlock is per assignment/batch) - not implemented.
 */
import { and, desc, eq, inArray } from 'drizzle-orm';
import {
  db, users, tests, testAttempts, testWindows, sprintAttempts, sprintAnswers, sprintSets,
  marathonAttempts, marathonAnswers, marathonPauseEvents, marathonDays, marathonChapters,
  recordings, recordingAccessGrants, classSessions,
} from '@/lib/db';
import { ApiException } from '@/lib/api-utils';
import { recordAudit } from '@/lib/audit-log';
import type { SuperActor } from '@/lib/super/guard';

const audit = (p: Parameters<typeof recordAudit>[0]) =>
  recordAudit(p).catch(e => console.error('[super/people] audit failed', e));

const ms = (d: Date | null | undefined) => (d ? d.getTime() : null);

export async function getStudentOverview(userId: number) {
  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) throw new ApiException('User not found', 404);

  const [testRows, sprintRows, marathonRows, recRows] = await Promise.all([
    db.select({ a: testAttempts, title: tests.title }).from(testAttempts)
      .innerJoin(tests, eq(testAttempts.testId, tests.id)).where(eq(testAttempts.userId, userId))
      .orderBy(desc(testAttempts.startedAt)).limit(50),
    db.select({ a: sprintAttempts, title: sprintSets.title }).from(sprintAttempts)
      .innerJoin(sprintSets, eq(sprintAttempts.setId, sprintSets.id)).where(eq(sprintAttempts.userId, userId))
      .orderBy(desc(sprintAttempts.submittedAt)).limit(50),
    db.select({ a: marathonAttempts, day: marathonDays.dayNumber, chapter: marathonChapters.title }).from(marathonAttempts)
      .innerJoin(marathonDays, eq(marathonAttempts.dayId, marathonDays.id))
      .innerJoin(marathonChapters, eq(marathonDays.chapterId, marathonChapters.id))
      .where(eq(marathonAttempts.userId, userId)).orderBy(desc(marathonAttempts.startedAt)).limit(50),
    db.select({ id: recordings.id, title: classSessions.title, at: classSessions.scheduledAt }).from(recordings)
      .innerJoin(classSessions, eq(recordings.classSessionId, classSessions.id))
      .where(eq(recordings.status, 'available')).orderBy(desc(classSessions.scheduledAt)).limit(40),
  ]);
  const grants = recRows.length
    ? await db.select().from(recordingAccessGrants)
        .where(and(eq(recordingAccessGrants.userId, userId), inArray(recordingAccessGrants.recordingId, recRows.map(r => r.id))))
    : [];
  const grantBy = new Map(grants.map(g => [g.recordingId, g.expiresAt.getTime()]));

  return {
    user: { id: user.id, name: user.name, email: user.email, studentId: user.studentId, batch: user.batch, role: user.role, status: user.status },
    tests: testRows.map(r => ({ id: r.a.id, title: r.title, status: r.a.status, mode: r.a.mode, score: r.a.totalScore, startedAt: ms(r.a.startedAt), submittedAt: ms(r.a.submittedAt) })),
    sprints: sprintRows.map(r => ({ id: r.a.id, title: r.title, correct: r.a.totalCorrect, of: r.a.totalQuestions, submittedAt: ms(r.a.submittedAt) })),
    marathon: marathonRows.map(r => ({ id: r.a.id, chapter: r.chapter, day: r.day, status: r.a.status, correct: r.a.totalCorrect, startedAt: ms(r.a.startedAt) })),
    recordings: recRows.map(r => ({ id: r.id, title: r.title, at: ms(r.at), grantedUntil: grantBy.get(r.id) ?? null })),
  };
}

/** Reopen a submitted attempt, or extend an in-progress one, until now + `minutes`. */
export async function grantTestTime(actor: SuperActor, attemptId: number, minutes: number, reopen: boolean) {
  const attempt = await db.select().from(testAttempts).where(eq(testAttempts.id, attemptId)).get();
  if (!attempt) throw new ApiException('Attempt not found', 404);
  if (reopen && attempt.status !== 'submitted') throw new ApiException('Only a submitted attempt can be reopened', 409);
  if (!reopen && attempt.status !== 'in_progress') throw new ApiException('Only an in-progress attempt can be extended', 409);

  const now = new Date();
  const closesAt = new Date(now.getTime() + minutes * 60_000);
  const after = await db.transaction(async tx => {
    const [w] = await tx.insert(testWindows).values({
      testId: attempt.testId, mode: attempt.mode, opensAt: now, closesAt, durationMinutes: null,
      status: 'open', createdBy: actor.id,
    }).returning();
    const patch = reopen
      ? { status: 'in_progress', submittedAt: null, totalScore: null, totalCorrect: null, totalWrong: null, totalUnattempted: null, sectionScores: null, bestSnapshot: null, windowId: w.id }
      : { windowId: w.id };
    await tx.update(testAttempts).set(patch).where(eq(testAttempts.id, attemptId));
    return { windowId: w.id, status: patch.status ?? attempt.status, closesAt: closesAt.getTime() };
  });
  await audit({
    actorUserId: actor.id, action: reopen ? 'override.test.reopen' : 'override.test.extend', entityType: 'test_attempt', entityId: attemptId,
    before: { userId: attempt.userId, testId: attempt.testId, status: attempt.status, windowId: attempt.windowId, totalScore: attempt.totalScore, totalCorrect: attempt.totalCorrect, submittedAt: ms(attempt.submittedAt) },
    after,
  });
  return after;
}

export async function grantRecordingToStudent(actor: SuperActor, userId: number, recordingId: number, days: number) {
  const rec = await db.select({ id: recordings.id }).from(recordings).where(eq(recordings.id, recordingId)).get();
  if (!rec) throw new ApiException('Recording not found', 404);
  const expiresAt = new Date(Date.now() + days * 86_400_000);
  const [g] = await db.insert(recordingAccessGrants).values({ recordingId, userId, expiresAt, grantedBy: actor.id }).returning();
  await audit({
    actorUserId: actor.id, action: 'override.recording.grant', entityType: 'recording', entityId: recordingId,
    before: { userId, hadGrant: false }, after: { userId, grantId: g.id, expiresAt: expiresAt.getTime() },
  });
  return { grantId: g.id, expiresAt: expiresAt.getTime() };
}

export async function resetSprintAttempt(actor: SuperActor, attemptId: number) {
  const a = await db.select().from(sprintAttempts).where(eq(sprintAttempts.id, attemptId)).get();
  if (!a) throw new ApiException('Attempt not found', 404);
  const answers = await db.select().from(sprintAnswers).where(eq(sprintAnswers.attemptId, attemptId));
  await db.transaction(async tx => {
    await tx.delete(sprintAnswers).where(eq(sprintAnswers.attemptId, attemptId));
    await tx.delete(sprintAttempts).where(eq(sprintAttempts.id, attemptId));
  });
  await audit({ actorUserId: actor.id, action: 'override.sprint.reset', entityType: 'sprint_attempt', entityId: attemptId, before: { attempt: a, answers }, after: null });
}

export async function resetMarathonAttempt(actor: SuperActor, attemptId: number) {
  const a = await db.select().from(marathonAttempts).where(eq(marathonAttempts.id, attemptId)).get();
  if (!a) throw new ApiException('Attempt not found', 404);
  const answers = await db.select().from(marathonAnswers).where(eq(marathonAnswers.attemptId, attemptId));
  await db.transaction(async tx => {
    await tx.delete(marathonAnswers).where(eq(marathonAnswers.attemptId, attemptId));
    await tx.delete(marathonPauseEvents).where(eq(marathonPauseEvents.attemptId, attemptId));
    await tx.delete(marathonAttempts).where(eq(marathonAttempts.id, attemptId));
  });
  await audit({ actorUserId: actor.id, action: 'override.marathon.reset', entityType: 'marathon_attempt', entityId: attemptId, before: { attempt: a, answers }, after: null });
}

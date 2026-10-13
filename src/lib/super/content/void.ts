/**
 * Void / un-void a submitted attempt. Reuses status 'banned' (no schema change): every
 * leaderboard/results/analytics reader filters status = 'submitted', so a banned attempt is
 * excluded everywhere. A voided attempt is 'banned' WITH submittedAt set (violation bans
 * happen mid-attempt, before any submission); the score columns are kept so un-void is lossless.
 */
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { testAttempts } from '@/lib/db/schema';
import { ApiException } from '@/lib/api-utils';
import { recordAudit } from '@/lib/audit-log';

export async function voidAttempt(attemptId: number, reason: string, actorId: number): Promise<void> {
  if (reason.trim().length < 3) throw new ApiException('A reason is required', 400);
  const a = await db.select().from(testAttempts).where(eq(testAttempts.id, attemptId)).get();
  if (!a) throw new ApiException('Attempt not found', 404);
  if (a.status !== 'submitted') throw new ApiException('Only submitted attempts can be voided', 409);
  await db.update(testAttempts).set({ status: 'banned', bannedAt: new Date() }).where(eq(testAttempts.id, attemptId));
  await recordAudit({
    actorUserId: actorId, action: 'attempt.void', entityType: 'test_attempt', entityId: attemptId,
    before: { status: a.status, totalScore: a.totalScore, testId: a.testId, userId: a.userId },
    after: { status: 'banned', reason: reason.trim() },
  });
}

export async function unvoidAttempt(attemptId: number, actorId: number): Promise<void> {
  const a = await db.select().from(testAttempts).where(eq(testAttempts.id, attemptId)).get();
  if (!a) throw new ApiException('Attempt not found', 404);
  if (a.status !== 'banned' || !a.submittedAt) throw new ApiException('Attempt is not voided', 409);
  await db.update(testAttempts).set({ status: 'submitted', bannedAt: null }).where(eq(testAttempts.id, attemptId));
  await recordAudit({
    actorUserId: actorId, action: 'attempt.unvoid', entityType: 'test_attempt', entityId: attemptId,
    before: { status: 'banned' }, after: { status: 'submitted' },
  });
}

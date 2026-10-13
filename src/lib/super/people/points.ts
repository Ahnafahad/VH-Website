/**
 * LexiCore points tools. Positive adjustments go through awardPoints; negative ones use the same two columns,
 * floored at 0. The weekly board is driven by vocab_user_progress.weekly_points, so "reset the board" zeroes that,
 * after snapshotting every affected row to lms_settings[super:people:points-snapshot] so one click can undo it.
 * Undo ADDS the snapshot back (points earned since the reset are kept), then discards the snapshot.
 */
import { eq, gt, sql } from 'drizzle-orm';
import { db, lmsSettings, vocabUserProgress } from '@/lib/db';
import { ApiException } from '@/lib/api-utils';
import { awardPoints } from '@/lib/vocab/points';
import { recordAudit } from '@/lib/audit-log';
import type { SuperActor } from '@/lib/super/guard';

export const SNAPSHOT_KEY = 'super:people:points-snapshot';
export interface PointsSnapshot { takenAt: number; actorId: number; reason: string; rows: [number, number][] }

const audit = (p: Parameters<typeof recordAudit>[0]) =>
  recordAudit(p).catch(e => console.error('[super/people] audit failed', e));

export async function getSnapshot(): Promise<PointsSnapshot | null> {
  const row = await db.select().from(lmsSettings).where(eq(lmsSettings.key, SNAPSHOT_KEY)).get();
  if (!row) return null;
  try { return JSON.parse(row.value) as PointsSnapshot; } catch { return null; }
}

export async function getStudentPoints(userId: number) {
  const p = await db.select({ total: vocabUserProgress.totalPoints, weekly: vocabUserProgress.weeklyPoints })
    .from(vocabUserProgress).where(eq(vocabUserProgress.userId, userId)).get();
  return p ?? null;
}

export async function adjustPoints(actor: SuperActor, userId: number, delta: number, reason: string) {
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100_000) throw new ApiException('Delta must be a non-zero integer (max 100000)', 400);
  const why = reason.trim();
  if (!why) throw new ApiException('A reason is required', 400);
  const before = await getStudentPoints(userId);
  if (!before) throw new ApiException('This student has no LexiCore progress yet', 404);

  const now = new Date();
  if (delta > 0) {
    await awardPoints(db, userId, delta, now);
  } else {
    await db.update(vocabUserProgress).set({
      totalPoints:  sql`max(0, ${vocabUserProgress.totalPoints} + ${delta})`,
      weeklyPoints: sql`max(0, ${vocabUserProgress.weeklyPoints} + ${delta})`,
      updatedAt: now,
    }).where(eq(vocabUserProgress.userId, userId));
  }
  const after = await getStudentPoints(userId);
  await audit({ actorUserId: actor.id, action: 'points.adjust', entityType: 'user', entityId: userId, before: { ...before, reason: why }, after: { ...after, delta } });
  return after;
}

export async function resetWeeklyBoard(actor: SuperActor, reason: string) {
  const why = reason.trim();
  if (!why) throw new ApiException('A reason is required', 400);
  const affected = await db.select({ userId: vocabUserProgress.userId, w: vocabUserProgress.weeklyPoints })
    .from(vocabUserProgress).where(gt(vocabUserProgress.weeklyPoints, 0));
  if (affected.length === 0) throw new ApiException('Nothing to reset: every weekly total is already 0', 409);

  const snap: PointsSnapshot = { takenAt: Date.now(), actorId: actor.id, reason: why, rows: affected.map(a => [a.userId, a.w]) };
  // Snapshot first: if the reset then fails, the worst case is a harmless unused snapshot.
  await db.insert(lmsSettings).values({ key: SNAPSHOT_KEY, value: JSON.stringify(snap) })
    .onConflictDoUpdate({ target: lmsSettings.key, set: { value: JSON.stringify(snap), updatedAt: new Date() } });
  await db.update(vocabUserProgress).set({ weeklyPoints: 0, updatedAt: new Date() }).where(gt(vocabUserProgress.weeklyPoints, 0));
  await audit({ actorUserId: actor.id, action: 'points.weekly.reset', entityType: 'leaderboard', before: { rows: affected.length, reason: why }, after: { weeklyPoints: 0 } });
  return { reset: affected.length };
}

export async function undoWeeklyReset(actor: SuperActor) {
  const snap = await getSnapshot();
  if (!snap) throw new ApiException('No reset snapshot to restore', 404);
  await db.$client.batch([
    ...snap.rows.map(([userId, w]) => ({
      // EXISTS guard: a concurrent second undo (snapshot already deleted by the first) adds nothing.
      sql: 'UPDATE vocab_user_progress SET weekly_points = weekly_points + ?, updated_at = unixepoch() WHERE user_id = ? AND EXISTS (SELECT 1 FROM lms_settings WHERE key = ?)', args: [w, userId, SNAPSHOT_KEY],
    })),
    { sql: 'DELETE FROM lms_settings WHERE key = ?', args: [SNAPSHOT_KEY] },
  ], 'write');
  await audit({ actorUserId: actor.id, action: 'points.weekly.undo', entityType: 'leaderboard', before: { takenAt: snap.takenAt, rows: snap.rows.length }, after: { restored: true } });
  return { restored: snap.rows.length };
}

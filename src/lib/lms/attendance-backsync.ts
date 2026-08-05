/**
 * Attendance back-sync — the explicit admin action that repairs PAST classes,
 * as opposed to attendance-pull.ts's live per-submission write.
 *
 * "Fills gaps" means: for every past SUBMITTED ONLINE test attempt, make sure
 * the online-attendance fact for its matched class session exists —
 *   - no attendance row for (session, user) yet          -> insert it
 *   - a row exists, mode='offline', NOT source='manual'   -> upgrade to online
 * and does NOT touch:
 *   - a row that already IS 'online' (nothing to fill)
 *   - a row that is mode='offline' AND source='manual' (an instructor's
 *     deliberate call — never overwritten by this, per spec)
 *   - any attempt with no safe single session match (see resolveAttendanceSession)
 *
 * Read-only planning (planAttendanceBackSync) is always safe to call — it
 * never writes. Applying (applyAttendanceBackSync) is a separate step and
 * must only be invoked from an explicit admin action (the --apply flag on
 * scripts/backfill-attendance-pull.ts), never automatically.
 */

import { and, eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type * as schema from '@/lib/db/schema';
import { classAttendance, testAttempts } from '@/lib/db/schema';
import { resolveAttendanceSession } from './attendance-pull';

type DrizzleClient = LibSQLDatabase<typeof schema>;

export interface BackSyncWriteItem {
  attemptId: number;
  userId: number;
  sessionId: number;
  joinedAt: Date;
  action: 'insert' | 'upgrade';
}

export interface BackSyncSkipItem {
  attemptId: number;
  userId: number;
  sessionId: number | null;
  reason: 'no-match' | 'already-online' | 'manual-protected';
}

export interface BackSyncPlan {
  toWrite: BackSyncWriteItem[];
  skipped: BackSyncSkipItem[];
}

/** Computes what the back-sync WOULD do. Read-only — never writes. */
export async function planAttendanceBackSync(db: DrizzleClient): Promise<BackSyncPlan> {
  const attempts = await db
    .select({
      id: testAttempts.id,
      userId: testAttempts.userId,
      windowId: testAttempts.windowId,
      submittedAt: testAttempts.submittedAt,
    })
    .from(testAttempts)
    .where(and(eq(testAttempts.status, 'submitted'), eq(testAttempts.mode, 'online')));

  const toWrite: BackSyncWriteItem[] = [];
  const skipped: BackSyncSkipItem[] = [];

  for (const a of attempts) {
    if (!a.submittedAt) continue; // defensive — submitted attempts always have this

    const sessionId = await resolveAttendanceSession(db, { windowId: a.windowId, submittedAt: a.submittedAt });
    if (sessionId == null) {
      skipped.push({ attemptId: a.id, userId: a.userId, sessionId: null, reason: 'no-match' });
      continue;
    }

    const existing = await db
      .select({ mode: classAttendance.mode, source: classAttendance.source })
      .from(classAttendance)
      .where(and(eq(classAttendance.sessionId, sessionId), eq(classAttendance.userId, a.userId)))
      .get();

    if (!existing) {
      toWrite.push({ attemptId: a.id, userId: a.userId, sessionId, joinedAt: a.submittedAt, action: 'insert' });
    } else if (existing.mode === 'online') {
      skipped.push({ attemptId: a.id, userId: a.userId, sessionId, reason: 'already-online' });
    } else if (existing.source === 'manual') {
      skipped.push({ attemptId: a.id, userId: a.userId, sessionId, reason: 'manual-protected' });
    } else {
      toWrite.push({ attemptId: a.id, userId: a.userId, sessionId, joinedAt: a.submittedAt, action: 'upgrade' });
    }
  }

  return { toWrite, skipped };
}

/** Applies a plan already computed by planAttendanceBackSync. Returns rows written. */
export async function applyAttendanceBackSync(db: DrizzleClient, plan: BackSyncPlan): Promise<number> {
  for (const item of plan.toWrite) {
    await db
      .insert(classAttendance)
      .values({ sessionId: item.sessionId, userId: item.userId, joinedAt: item.joinedAt, mode: 'online', source: 'pulled' })
      .onConflictDoUpdate({
        target: [classAttendance.sessionId, classAttendance.userId],
        set: { mode: 'online', source: 'pulled' },
      });
  }
  return plan.toWrite.length;
}

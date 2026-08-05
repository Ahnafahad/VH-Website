/**
 * Attendance auto-pull: "a student who submitted a test online was present
 * online" for the class it belongs to.
 *
 * Session matching, in order:
 *  1. The test window's explicit `classSessionId` link (schema.ts
 *     testWindows.classSessionId, set by an admin from the test admin UI) —
 *     trusted outright. This is the only reliable link when one test spans
 *     several sittings on different days (e.g. the FBS diagnostics ran
 *     Jul 21 -> 31) — a test-level link would map every attempt to one
 *     wrong session, which is exactly why the link lives on the window.
 *  2. Fallback: same CALENDAR DATE (Dhaka local) match against
 *     class_sessions, excluding draft/cancelled sessions (those are not
 *     real classes). If exactly ONE session falls on that date, use it.
 *     If zero or more than one do, there is no safe way to choose without
 *     guessing — skip. No row is written; linking the window explicitly or
 *     marking attendance by hand still works.
 *
 * Only ONLINE test submissions trigger a write. Offline (paper) submissions
 * are not inferred into attendance here — that path is already covered by
 * the instructor's in-person manual attendance sheet.
 *
 * Online wins over an existing offline mark unconditionally on this LIVE
 * path, regardless of who/what set that offline row. The "never overwrite a
 * manually-set row" protection is a back-sync-only rule (see
 * attendance-backsync.ts) — the spec text places that carve-out under
 * back-sync specifically, not under this real-time pull.
 */

import { and, eq, gte, lt, notInArray } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type * as schema from '@/lib/db/schema';
import { classAttendance, classSessions, testWindows } from '@/lib/db/schema';
import { DHAKA_OFFSET_HOURS } from './constants';

type DrizzleClient = LibSQLDatabase<typeof schema>;

const DHAKA_OFFSET_MS = DHAKA_OFFSET_HOURS * 3600_000;

/** Dhaka-local calendar-day [start, end) as UTC Date bounds. */
export function dhakaDayRangeUtc(d: Date): { start: Date; end: Date } {
  const dhakaMs = d.getTime() + DHAKA_OFFSET_MS;
  const dhaka = new Date(dhakaMs);
  const dayStartDhakaMs = Date.UTC(dhaka.getUTCFullYear(), dhaka.getUTCMonth(), dhaka.getUTCDate());
  return {
    start: new Date(dayStartDhakaMs - DHAKA_OFFSET_MS),
    end: new Date(dayStartDhakaMs - DHAKA_OFFSET_MS + 86_400_000),
  };
}

/**
 * Resolves which class_session a submission maps to, or null if there is no
 * safe single match. Never guesses across an ambiguous multi-session day.
 */
export async function resolveAttendanceSession(
  db: DrizzleClient,
  args: { windowId: number; submittedAt: Date },
): Promise<number | null> {
  const window = await db
    .select({ classSessionId: testWindows.classSessionId })
    .from(testWindows)
    .where(eq(testWindows.id, args.windowId))
    .get();

  if (window?.classSessionId != null) return window.classSessionId;

  const { start, end } = dhakaDayRangeUtc(args.submittedAt);
  const candidates = await db
    .select({ id: classSessions.id })
    .from(classSessions)
    .where(and(
      gte(classSessions.scheduledAt, start),
      lt(classSessions.scheduledAt, end),
      // draft never happened, cancelled didn't either — neither is a real class.
      notInArray(classSessions.status, ['draft', 'cancelled']),
    ));

  if (candidates.length !== 1) return null; // 0 or ambiguous (>1) — skip, don't guess
  return candidates[0].id;
}

export interface PullResult {
  written: boolean;
  sessionId: number | null;
  reason?: 'not-online' | 'no-match' | 'already-online';
}

/**
 * Live, per-submission pull — call right after a test attempt is marked
 * submitted. Only acts on ONLINE-mode attempts. Best-effort: a caller must
 * not let a failure here fail the submission itself (wrap in try/catch).
 */
export async function pullAttendanceForSubmission(
  db: DrizzleClient,
  args: { userId: number; windowId: number; mode: string; submittedAt: Date },
): Promise<PullResult> {
  if (args.mode !== 'online') {
    return { written: false, sessionId: null, reason: 'not-online' };
  }

  const sessionId = await resolveAttendanceSession(db, {
    windowId: args.windowId,
    submittedAt: args.submittedAt,
  });
  if (sessionId == null) {
    return { written: false, sessionId: null, reason: 'no-match' };
  }

  const existing = await db
    .select({ mode: classAttendance.mode })
    .from(classAttendance)
    .where(and(eq(classAttendance.sessionId, sessionId), eq(classAttendance.userId, args.userId)))
    .get();

  if (existing?.mode === 'online') {
    return { written: false, sessionId, reason: 'already-online' };
  }

  await db
    .insert(classAttendance)
    .values({ sessionId, userId: args.userId, joinedAt: args.submittedAt, mode: 'online', source: 'pulled' })
    .onConflictDoUpdate({
      target: [classAttendance.sessionId, classAttendance.userId],
      set: { mode: 'online', source: 'pulled' },
    });

  return { written: true, sessionId };
}

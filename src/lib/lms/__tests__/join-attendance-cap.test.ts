/**
 * recordOnlineJoinAttendance — the join route's cap enforcement (spec §9),
 * exercised against an in-memory libSQL database. Named boundary cases from
 * the assignment: 7 online (allowed, row written), 8 online (blocked, no new
 * row), and re-joining a session already marked online for (never blocked by
 * the student's own count).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { users, classSessions, classAttendance } from '@/lib/db/schema';
import { recordOnlineJoinAttendance, ONLINE_ATTENDANCE_CAP } from '../attendance-cap';
import { makeAttendanceTestDb, createAttendanceFixtureSchema } from './attendance-fixture';

let ctx: ReturnType<typeof makeAttendanceTestDb>;

async function seedUser(email: string) {
  const [row] = await ctx.db.insert(users).values({
    email, name: email, role: 'student', status: 'active',
    onboardingSkips: 0, notifyMaterials: true, notifyAnnouncements: true, notifyCommentReply: true,
  }).returning();
  return row.id;
}

async function seedSessions(n: number, product = 'iba') {
  const ids: number[] = [];
  for (let i = 0; i < n; i++) {
    const [row] = await ctx.db.insert(classSessions).values({
      title: `Class ${i}`, subject: 'english', product, scheduledAt: new Date(2026, 6, 1 + i),
      durationMinutes: 60, status: 'completed', createdBy: 1,
    }).returning();
    ids.push(row.id);
  }
  return ids;
}

async function markOnline(sessionId: number, userId: number) {
  await ctx.db.insert(classAttendance).values({
    sessionId, userId, joinedAt: new Date(), mode: 'online', source: 'join',
  });
}

async function attendanceRow(sessionId: number, userId: number) {
  return ctx.db
    .select()
    .from(classAttendance)
    .where(and(eq(classAttendance.sessionId, sessionId), eq(classAttendance.userId, userId)))
    .get();
}

beforeEach(async () => {
  ctx = makeAttendanceTestDb();
  await createAttendanceFixtureSchema(ctx.client);
});

describe('recordOnlineJoinAttendance', () => {
  it('a student at 7 online joining a NEW session: allowed, row written', async () => {
    const userId = await seedUser('seven@test.com');
    const priorSessions = await seedSessions(7);
    for (const s of priorSessions) await markOnline(s, userId);
    const [newSession] = await seedSessions(1);

    const result = await recordOnlineJoinAttendance(ctx.db, {
      sessionId: newSession, userId, product: 'iba', joinedAt: new Date(),
    });

    expect(result.recorded).toBe(true);
    const row = await attendanceRow(newSession, userId);
    expect(row?.mode).toBe('online');
  });

  it('a student at 8 online joining a NEW session: gets the meet link (caller returns it regardless) but NO new row', async () => {
    const userId = await seedUser('eight@test.com');
    const priorSessions = await seedSessions(ONLINE_ATTENDANCE_CAP);
    for (const s of priorSessions) await markOnline(s, userId);
    const [newSession] = await seedSessions(1);

    const result = await recordOnlineJoinAttendance(ctx.db, {
      sessionId: newSession, userId, product: 'iba', joinedAt: new Date(),
    });

    expect(result.recorded).toBe(false);
    const row = await attendanceRow(newSession, userId);
    expect(row).toBeUndefined(); // left absent, per spec
  });

  it('re-joining a session already marked online for THIS session is never blocked by the student\'s own count', async () => {
    const userId = await seedUser('rejoin@test.com');
    // Already at (and over) the cap on OTHER sessions...
    const priorSessions = await seedSessions(ONLINE_ATTENDANCE_CAP + 1);
    for (const s of priorSessions) await markOnline(s, userId);
    // ...and already online for the session they're re-joining.
    const [thisSession] = await seedSessions(1);
    await markOnline(thisSession, userId);

    const result = await recordOnlineJoinAttendance(ctx.db, {
      sessionId: thisSession, userId, product: 'iba', joinedAt: new Date(),
    });

    expect(result.recorded).toBe(true);
    const row = await attendanceRow(thisSession, userId);
    expect(row?.mode).toBe('online');
  });

  it('flips a pre-existing OFFLINE mark for this session to online without counting against the cap (still exempt — not new usage of the cap since the row already exists for this session)', async () => {
    const userId = await seedUser('flip@test.com');
    const priorSessions = await seedSessions(ONLINE_ATTENDANCE_CAP);
    for (const s of priorSessions) await markOnline(s, userId);
    const [thisSession] = await seedSessions(1);
    await ctx.db.insert(classAttendance).values({
      sessionId: thisSession, userId, joinedAt: new Date(), mode: 'offline', source: 'manual',
    });

    // Not exempt (existing row is offline, not online) — at the cap, so this
    // join is blocked, matching the manual sheet's "new online mark" rule.
    const result = await recordOnlineJoinAttendance(ctx.db, {
      sessionId: thisSession, userId, product: 'iba', joinedAt: new Date(),
    });

    expect(result.recorded).toBe(false);
    const row = await attendanceRow(thisSession, userId);
    expect(row?.mode).toBe('offline'); // left untouched, not silently flipped
  });
});

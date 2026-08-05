/**
 * attendance-cap.ts — the 8-online-per-student-per-course hard cap, exercised
 * against an in-memory libSQL database. Covers the assignment's named edge
 * cases: exactly 7 (allowed), exactly 8 (blocked), and 9 (blocked, no crash —
 * e.g. legacy/back-synced data that already sits over the cap).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { users, classSessions, classAttendance } from '@/lib/db/schema';
import { ONLINE_ATTENDANCE_CAP, countOnlineAttendance, countOnlineAttendanceBatch } from '../attendance-cap';
import { makeAttendanceTestDb, createAttendanceFixtureSchema } from './attendance-fixture';

let ctx: ReturnType<typeof makeAttendanceTestDb>;

async function seedUser(email: string) {
  const [row] = await ctx.db.insert(users).values({
    email, name: email, role: 'student', status: 'active',
    onboardingSkips: 0, notifyMaterials: true, notifyAnnouncements: true, notifyCommentReply: true,
  }).returning();
  return row.id;
}

/** N distinct sessions of `product` (attendance is UNIQUE(session,user), so cap-testing needs distinct sessions). */
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
    sessionId, userId, joinedAt: new Date(), mode: 'online', source: 'manual',
  });
}

beforeEach(async () => {
  ctx = makeAttendanceTestDb();
  await createAttendanceFixtureSchema(ctx.client);
});

describe('ONLINE_ATTENDANCE_CAP', () => {
  it('is 8', () => {
    expect(ONLINE_ATTENDANCE_CAP).toBe(8);
  });
});

describe('countOnlineAttendance', () => {
  it('at exactly 7 online rows: below the cap, marking online would be ALLOWED', async () => {
    const userId = await seedUser('seven@test.com');
    const sessions = await seedSessions(7);
    for (const s of sessions) await markOnline(s, userId);

    const count = await countOnlineAttendance(ctx.db, userId, 'iba');
    expect(count).toBe(7);
    expect(count >= ONLINE_ATTENDANCE_CAP).toBe(false); // not blocked
  });

  it('at exactly 8 online rows: at the cap, marking a NEW session online would be BLOCKED', async () => {
    const userId = await seedUser('eight@test.com');
    const sessions = await seedSessions(8);
    for (const s of sessions) await markOnline(s, userId);

    const count = await countOnlineAttendance(ctx.db, userId, 'iba');
    expect(count).toBe(8);
    expect(count >= ONLINE_ATTENDANCE_CAP).toBe(true); // blocked
  });

  it('at 9 online rows (over-cap legacy data): still reports BLOCKED, no crash', async () => {
    const userId = await seedUser('nine@test.com');
    const sessions = await seedSessions(9);
    for (const s of sessions) await markOnline(s, userId);

    const count = await countOnlineAttendance(ctx.db, userId, 'iba');
    expect(count).toBe(9);
    expect(count >= ONLINE_ATTENDANCE_CAP).toBe(true);
  });

  it('only counts online rows for the matching product — a different course does not share the cap', async () => {
    const userId = await seedUser('multi@test.com');
    const [ibaSession] = await seedSessions(1, 'iba');
    const [fbsSession] = await seedSessions(1, 'fbs');
    await markOnline(ibaSession, userId);
    await markOnline(fbsSession, userId);

    expect(await countOnlineAttendance(ctx.db, userId, 'iba')).toBe(1);
    expect(await countOnlineAttendance(ctx.db, userId, 'fbs')).toBe(1);
  });

  it('does not count offline rows toward the cap', async () => {
    const userId = await seedUser('offline@test.com');
    const [sessionId] = await seedSessions(1);
    await ctx.db.insert(classAttendance).values({
      sessionId, userId, joinedAt: new Date(), mode: 'offline', source: 'manual',
    });
    expect(await countOnlineAttendance(ctx.db, userId, 'iba')).toBe(0);
  });
});

describe('countOnlineAttendanceBatch', () => {
  it('returns each student\'s own count in one grouped query', async () => {
    const a = await seedUser('batch-a@test.com');
    const b = await seedUser('batch-b@test.com');
    const sessions = await seedSessions(8);
    for (const s of sessions.slice(0, 7)) await markOnline(s, a); // 7 for a
    for (const s of sessions.slice(0, 8)) await markOnline(s, b); // 8 for b

    const map = await countOnlineAttendanceBatch(ctx.db, [a, b], 'iba');
    expect(map.get(a)).toBe(7);
    expect(map.get(b)).toBe(8);
  });

  it('a student with zero online rows is simply absent from the map (not zero-valued)', async () => {
    const a = await seedUser('zero@test.com');
    const map = await countOnlineAttendanceBatch(ctx.db, [a], 'iba');
    expect(map.get(a)).toBeUndefined();
    expect(map.get(a) ?? 0).toBe(0); // callers must default with ?? 0, as the route/roster code does
  });
});

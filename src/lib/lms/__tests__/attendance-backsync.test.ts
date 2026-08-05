/**
 * attendance-backsync.ts exercised against an in-memory libSQL database.
 * The one rule the assignment calls out explicitly: back-sync fills gaps but
 * NEVER overwrites a row an instructor set manually (source='manual').
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { users, classSessions, classAttendance, testWindows, testAttempts } from '@/lib/db/schema';
import { planAttendanceBackSync, applyAttendanceBackSync } from '../attendance-backsync';
import { makeAttendanceTestDb, createAttendanceFixtureSchema } from './attendance-fixture';

let ctx: ReturnType<typeof makeAttendanceTestDb>;
const JUL_09 = new Date('2026-07-09T10:00:00Z');

async function seedUser(email: string) {
  const [row] = await ctx.db.insert(users).values({
    email, name: email, role: 'student', status: 'active',
    onboardingSkips: 0, notifyMaterials: true, notifyAnnouncements: true, notifyCommentReply: true,
  }).returning();
  return row.id;
}

async function seedSession(date: Date, title = 'Class') {
  const [row] = await ctx.db.insert(classSessions).values({
    title, subject: 'english', product: 'iba', scheduledAt: date, durationMinutes: 60,
    status: 'completed', createdBy: 1,
  }).returning();
  return row.id;
}

async function seedWindow() {
  const [row] = await ctx.db.insert(testWindows).values({
    testId: 1, mode: 'online', opensAt: new Date('2026-07-01'), closesAt: new Date('2026-12-01'),
    classSessionId: null, status: 'closed',
  }).returning();
  return row.id;
}

async function seedSubmittedAttempt(userId: number, windowId: number, mode: 'online' | 'offline', submittedAt: Date) {
  const [row] = await ctx.db.insert(testAttempts).values({
    testId: 1, userId, windowId, mode, status: 'submitted',
    startedAt: submittedAt, submittedAt, tabLeaveCount: 0, resetCount: 0,
  }).returning();
  return row.id;
}

beforeEach(async () => {
  ctx = makeAttendanceTestDb();
  await createAttendanceFixtureSchema(ctx.client);
});

describe('planAttendanceBackSync — read-only planning', () => {
  it('plans an INSERT for a gap (no existing row)', async () => {
    const userId = await seedUser('a@test.com');
    const sessionId = await seedSession(JUL_09);
    const windowId = await seedWindow();
    await seedSubmittedAttempt(userId, windowId, 'online', JUL_09);

    const plan = await planAttendanceBackSync(ctx.db);
    expect(plan.toWrite).toEqual([
      expect.objectContaining({ userId, sessionId, action: 'insert' }),
    ]);
    expect(plan.skipped).toEqual([]);
  });

  it('plans an UPGRADE for an existing OFFLINE row that is NOT source=manual', async () => {
    const userId = await seedUser('b@test.com');
    const sessionId = await seedSession(JUL_09);
    const windowId = await seedWindow();
    await seedSubmittedAttempt(userId, windowId, 'online', JUL_09);
    await ctx.db.insert(classAttendance).values({ sessionId, userId, joinedAt: JUL_09, mode: 'offline', source: 'join' });

    const plan = await planAttendanceBackSync(ctx.db);
    expect(plan.toWrite).toEqual([
      expect.objectContaining({ userId, sessionId, action: 'upgrade' }),
    ]);
  });

  it('NEVER plans to touch a row an instructor set manually (source=manual)', async () => {
    const userId = await seedUser('c@test.com');
    const sessionId = await seedSession(JUL_09);
    const windowId = await seedWindow();
    await seedSubmittedAttempt(userId, windowId, 'online', JUL_09);
    await ctx.db.insert(classAttendance).values({ sessionId, userId, joinedAt: JUL_09, mode: 'offline', source: 'manual' });

    const plan = await planAttendanceBackSync(ctx.db);
    expect(plan.toWrite).toEqual([]);
    expect(plan.skipped).toEqual([
      expect.objectContaining({ userId, sessionId, reason: 'manual-protected' }),
    ]);
  });

  it('skips a row that is already online (nothing to fill)', async () => {
    const userId = await seedUser('d@test.com');
    const sessionId = await seedSession(JUL_09);
    const windowId = await seedWindow();
    await seedSubmittedAttempt(userId, windowId, 'online', JUL_09);
    await ctx.db.insert(classAttendance).values({ sessionId, userId, joinedAt: JUL_09, mode: 'online', source: 'join' });

    const plan = await planAttendanceBackSync(ctx.db);
    expect(plan.toWrite).toEqual([]);
    expect(plan.skipped).toEqual([
      expect.objectContaining({ userId, sessionId, reason: 'already-online' }),
    ]);
  });

  it('skips an attempt with an ambiguous/no date match', async () => {
    const userId = await seedUser('e@test.com');
    // Two sessions same day — ambiguous, no explicit link on the window.
    await seedSession(JUL_09, 'A');
    await seedSession(JUL_09, 'B');
    const windowId = await seedWindow();
    await seedSubmittedAttempt(userId, windowId, 'online', JUL_09);

    const plan = await planAttendanceBackSync(ctx.db);
    expect(plan.toWrite).toEqual([]);
    expect(plan.skipped).toEqual([
      expect.objectContaining({ userId, sessionId: null, reason: 'no-match' }),
    ]);
  });

  it('ignores in-progress and offline-mode attempts entirely', async () => {
    const userId = await seedUser('f@test.com');
    await seedSession(JUL_09);
    const windowId = await seedWindow();
    await seedSubmittedAttempt(userId, windowId, 'offline', JUL_09); // offline submitted — not considered
    await ctx.db.insert(testAttempts).values({
      testId: 1, userId, windowId, mode: 'online', status: 'in_progress',
      startedAt: JUL_09, tabLeaveCount: 0, resetCount: 0,
    }); // in-progress — not considered

    const plan = await planAttendanceBackSync(ctx.db);
    expect(plan.toWrite).toEqual([]);
    expect(plan.skipped).toEqual([]);
  });
});

describe('applyAttendanceBackSync — actually writes a computed plan', () => {
  it('inserts the gap row', async () => {
    const userId = await seedUser('g@test.com');
    const sessionId = await seedSession(JUL_09);
    const windowId = await seedWindow();
    await seedSubmittedAttempt(userId, windowId, 'online', JUL_09);

    const plan = await planAttendanceBackSync(ctx.db);
    const written = await applyAttendanceBackSync(ctx.db, plan);
    expect(written).toBe(1);

    const row = await ctx.db.select().from(classAttendance)
      .where(and(eq(classAttendance.sessionId, sessionId), eq(classAttendance.userId, userId))).get();
    expect(row?.mode).toBe('online');
    expect(row?.source).toBe('pulled');
  });

  it('leaves a manual-protected row completely untouched after apply', async () => {
    const userId = await seedUser('h@test.com');
    const sessionId = await seedSession(JUL_09);
    const windowId = await seedWindow();
    await seedSubmittedAttempt(userId, windowId, 'online', JUL_09);
    await ctx.db.insert(classAttendance).values({ sessionId, userId, joinedAt: JUL_09, mode: 'offline', source: 'manual' });

    const plan = await planAttendanceBackSync(ctx.db);
    await applyAttendanceBackSync(ctx.db, plan);

    const row = await ctx.db.select().from(classAttendance)
      .where(and(eq(classAttendance.sessionId, sessionId), eq(classAttendance.userId, userId))).get();
    expect(row?.mode).toBe('offline');
    expect(row?.source).toBe('manual');
  });
});

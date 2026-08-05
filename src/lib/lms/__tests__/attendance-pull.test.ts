/**
 * attendance-pull.ts exercised against a local in-memory libSQL database
 * (:memory:, never Turso/production). Covers the exact scenarios the
 * assignment calls out: a single same-date match, an ambiguous same-date
 * match (two sessions), the explicit link overriding the date fallback, and
 * online winning over an existing offline mark.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { users, classSessions, classAttendance, testWindows } from '@/lib/db/schema';
import { pullAttendanceForSubmission, resolveAttendanceSession } from '../attendance-pull';
import { makeAttendanceTestDb, createAttendanceFixtureSchema } from './attendance-fixture';

let ctx: ReturnType<typeof makeAttendanceTestDb>;
let studentId: number;
// Dates chosen well inside their Dhaka calendar day regardless of the +6h
// offset (10:00 UTC = 16:00 Dhaka, same calendar date either way).
const JUL_09 = new Date('2026-07-09T10:00:00Z');
const JUL_10 = new Date('2026-07-10T10:00:00Z');
const AUG_03 = new Date('2026-08-03T10:00:00Z');

async function seedUser() {
  const [student] = await ctx.db.insert(users).values({
    email: 'student@test.com', name: 'Student', role: 'student', status: 'active',
    onboardingSkips: 0, notifyMaterials: true, notifyAnnouncements: true, notifyCommentReply: true,
  }).returning();
  return student.id;
}

async function seedSession(date: Date, title = 'Class') {
  const [row] = await ctx.db.insert(classSessions).values({
    title, subject: 'english', product: 'iba', scheduledAt: date, durationMinutes: 60,
    status: 'completed', createdBy: 1,
  }).returning();
  return row.id;
}

async function seedWindow(classSessionId: number | null) {
  const [row] = await ctx.db.insert(testWindows).values({
    testId: 1, mode: 'online', opensAt: new Date('2026-07-01'), closesAt: new Date('2026-12-01'),
    classSessionId, status: 'closed',
  }).returning();
  return row.id;
}

beforeEach(async () => {
  ctx = makeAttendanceTestDb();
  await createAttendanceFixtureSchema(ctx.client);
  studentId = await seedUser();
});

describe('resolveAttendanceSession — same-date fallback (no explicit link)', () => {
  it('matches the single session on that calendar date', async () => {
    const sessionId = await seedSession(JUL_09);
    const windowId = await seedWindow(null);
    const resolved = await resolveAttendanceSession(ctx.db, { windowId, submittedAt: JUL_09 });
    expect(resolved).toBe(sessionId);
  });

  it('is ambiguous with TWO sessions on the same date and does NOT guess — resolves null', async () => {
    await seedSession(JUL_09, 'Math class');
    await seedSession(JUL_09, 'English class');
    const windowId = await seedWindow(null);
    const resolved = await resolveAttendanceSession(ctx.db, { windowId, submittedAt: JUL_09 });
    expect(resolved).toBeNull();
  });

  it('resolves null when there is no session on that date', async () => {
    await seedSession(JUL_09);
    const windowId = await seedWindow(null);
    const resolved = await resolveAttendanceSession(ctx.db, { windowId, submittedAt: JUL_10 });
    expect(resolved).toBeNull();
  });

  it('excludes draft and cancelled sessions from the date match', async () => {
    await ctx.db.insert(classSessions).values({
      title: 'Draft class', subject: 'math', product: 'iba', scheduledAt: JUL_09, durationMinutes: 60,
      status: 'draft', createdBy: 1,
    });
    await ctx.db.insert(classSessions).values({
      title: 'Cancelled class', subject: 'math', product: 'iba', scheduledAt: JUL_09, durationMinutes: 60,
      status: 'cancelled', createdBy: 1,
    });
    const realSessionId = await seedSession(JUL_09, 'Real class');
    const windowId = await seedWindow(null);
    const resolved = await resolveAttendanceSession(ctx.db, { windowId, submittedAt: JUL_09 });
    expect(resolved).toBe(realSessionId);
  });
});

describe('resolveAttendanceSession — explicit link wins outright', () => {
  it('uses the linked session even when its date does not match the submission date, and even when the submission date is itself ambiguous', async () => {
    const linkedSessionId = await seedSession(AUG_03, 'Linked sitting');
    // Ambiguous same-day noise on the actual submission date — must be ignored.
    await seedSession(JUL_09, 'Noise A');
    await seedSession(JUL_09, 'Noise B');
    const windowId = await seedWindow(linkedSessionId);

    const resolved = await resolveAttendanceSession(ctx.db, { windowId, submittedAt: JUL_09 });
    expect(resolved).toBe(linkedSessionId);
  });
});

describe('pullAttendanceForSubmission', () => {
  it('writes an online/pulled row on a clean single-date match', async () => {
    const sessionId = await seedSession(JUL_09);
    const windowId = await seedWindow(null);

    const result = await pullAttendanceForSubmission(ctx.db, {
      userId: studentId, windowId, mode: 'online', submittedAt: JUL_09,
    });
    expect(result).toEqual({ written: true, sessionId });

    const row = await ctx.db.select().from(classAttendance)
      .where(and(eq(classAttendance.sessionId, sessionId), eq(classAttendance.userId, studentId))).get();
    expect(row?.mode).toBe('online');
    expect(row?.source).toBe('pulled');
  });

  it('does nothing for an OFFLINE-mode submission — only online submissions are inferred', async () => {
    const sessionId = await seedSession(JUL_09);
    const windowId = await seedWindow(null);

    const result = await pullAttendanceForSubmission(ctx.db, {
      userId: studentId, windowId, mode: 'offline', submittedAt: JUL_09,
    });
    expect(result).toEqual({ written: false, sessionId: null, reason: 'not-online' });

    const row = await ctx.db.select().from(classAttendance)
      .where(and(eq(classAttendance.sessionId, sessionId), eq(classAttendance.userId, studentId))).get();
    expect(row).toBeUndefined();
  });

  it('skips (no write) when the date match is ambiguous', async () => {
    await seedSession(JUL_09, 'A');
    await seedSession(JUL_09, 'B');
    const windowId = await seedWindow(null);

    const result = await pullAttendanceForSubmission(ctx.db, {
      userId: studentId, windowId, mode: 'online', submittedAt: JUL_09,
    });
    expect(result).toEqual({ written: false, sessionId: null, reason: 'no-match' });
  });

  it('ONLINE WINS: flips an existing OFFLINE row to online, even one a human marked manually', async () => {
    const sessionId = await seedSession(JUL_09);
    const windowId = await seedWindow(null);
    await ctx.db.insert(classAttendance).values({
      sessionId, userId: studentId, joinedAt: JUL_09, mode: 'offline', source: 'manual',
    });

    const result = await pullAttendanceForSubmission(ctx.db, {
      userId: studentId, windowId, mode: 'online', submittedAt: JUL_09,
    });
    expect(result.written).toBe(true);

    const row = await ctx.db.select().from(classAttendance)
      .where(and(eq(classAttendance.sessionId, sessionId), eq(classAttendance.userId, studentId))).get();
    expect(row?.mode).toBe('online');
    expect(row?.source).toBe('pulled');
  });

  it('is a no-op when the row is already online (does not clobber its source)', async () => {
    const sessionId = await seedSession(JUL_09);
    const windowId = await seedWindow(null);
    await ctx.db.insert(classAttendance).values({
      sessionId, userId: studentId, joinedAt: JUL_09, mode: 'online', source: 'manual',
    });

    const result = await pullAttendanceForSubmission(ctx.db, {
      userId: studentId, windowId, mode: 'online', submittedAt: JUL_09,
    });
    expect(result).toEqual({ written: false, sessionId, reason: 'already-online' });

    const row = await ctx.db.select().from(classAttendance)
      .where(and(eq(classAttendance.sessionId, sessionId), eq(classAttendance.userId, studentId))).get();
    expect(row?.source).toBe('manual'); // untouched
  });
});

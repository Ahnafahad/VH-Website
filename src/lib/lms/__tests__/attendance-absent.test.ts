/**
 * Explicit-absent semantics against the in-memory fixture DB: summary/stats on
 * taken vs legacy classes, cap ignoring absent rows, join flipping absent to
 * present, and inferred (pull / back-sync) writes never overriding absent.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { classSessions, classAttendance, testWindows } from '@/lib/db/schema';
import { computeStudentAttendanceSummary } from '../attendance-summary';
import { countOnlineAttendance, recordOnlineJoinAttendance } from '../attendance-cap';
import { pullAttendanceForSubmission } from '../attendance-pull';
import { makeAttendanceTestDb, createAttendanceFixtureSchema } from './attendance-fixture';

let ctx: ReturnType<typeof makeAttendanceTestDb>;
const NOW = new Date('2026-08-05T00:00:00Z');
const TAKEN = new Date('2026-07-02T00:00:00Z');

async function seedSession(date: Date, taken: boolean) {
  const [row] = await ctx.db.insert(classSessions).values({
    title: 'Class', subject: 'english', product: 'iba', scheduledAt: date, durationMinutes: 60,
    status: 'completed', createdBy: 1, attendanceTakenAt: taken ? TAKEN : null,
  }).returning();
  return row.id;
}
const mark = (sessionId: number, userId: number, status: 'present' | 'absent', mode: 'online' | 'offline' = 'offline') =>
  ctx.db.insert(classAttendance).values({ sessionId, userId, joinedAt: new Date(), mode, source: 'manual', status });
const rowOf = (sessionId: number, userId: number) =>
  ctx.db.select().from(classAttendance)
    .where(and(eq(classAttendance.sessionId, sessionId), eq(classAttendance.userId, userId))).get();

beforeEach(async () => {
  ctx = makeAttendanceTestDb();
  await createAttendanceFixtureSchema(ctx.client);
});

describe('summary (stats uses the same pure helper)', () => {
  it('legacy class: no row = absent. Taken class: no row = present, explicit absent = absent', async () => {
    const legacy = await seedSession(new Date('2026-07-01'), false);
    const takenNoRow = await seedSession(new Date('2026-07-08'), true);
    const takenAbsent = await seedSession(new Date('2026-07-15'), true);
    await mark(takenAbsent, 42, 'absent');

    const [sum] = await computeStudentAttendanceSummary(ctx.db, { id: 42, batch: null, products: ['iba'] }, NOW);
    expect(sum.totalExpected).toBe(3);
    expect(sum.absences).toBe(2); // legacy (no row) + explicit absent
    expect(legacy).toBeGreaterThan(0);
    expect(takenNoRow).toBeGreaterThan(0);
  });
});

describe('cap', () => {
  it('ignores absent rows, even ones carrying an online mode', async () => {
    const s = await seedSession(new Date('2026-07-01'), true);
    await mark(s, 7, 'absent', 'online');
    expect(await countOnlineAttendance(ctx.db, 7, 'iba')).toBe(0);
  });
});

describe('join', () => {
  it('flips an explicit absent row to present/online', async () => {
    const s = await seedSession(new Date('2026-07-01'), true);
    await mark(s, 9, 'absent');
    const r = await recordOnlineJoinAttendance(ctx.db, { sessionId: s, userId: 9, product: 'iba', joinedAt: new Date() });
    expect(r.recorded).toBe(true);
    expect(await rowOf(s, 9)).toMatchObject({ status: 'present', mode: 'online', source: 'join' });
  });
});

describe('inferred pull', () => {
  it('never overwrites an explicit absent row', async () => {
    const s = await seedSession(new Date('2026-07-09T05:00:00Z'), true);
    const [w] = await ctx.db.insert(testWindows).values({
      testId: 1, mode: 'online', opensAt: new Date(), closesAt: new Date(), classSessionId: s, status: 'open',
    }).returning();
    await mark(s, 11, 'absent');
    const r = await pullAttendanceForSubmission(ctx.db, { userId: 11, windowId: w.id, mode: 'online', submittedAt: new Date('2026-07-09T06:00:00Z') });
    expect(r).toMatchObject({ written: false, reason: 'marked-absent' });
    expect(await rowOf(s, 11)).toMatchObject({ status: 'absent' });
  });
});

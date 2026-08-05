/**
 * attendance-summary.ts — the student-facing "online used / remaining /
 * absent" figures (dashboard -> My Attendance), against an in-memory
 * libSQL database. Absence is the ABSENCE of a class_attendance row,
 * computed against completed past sessions the student was expected at.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { classSessions, classAttendance } from '@/lib/db/schema';
import { computeStudentAttendanceSummary } from '../attendance-summary';
import { makeAttendanceTestDb, createAttendanceFixtureSchema } from './attendance-fixture';

let ctx: ReturnType<typeof makeAttendanceTestDb>;
const NOW = new Date('2026-08-05T00:00:00Z');

async function seedSession(opts: { date: Date; product?: string; batch?: string | null; status?: string }) {
  const [row] = await ctx.db.insert(classSessions).values({
    title: 'Class', subject: 'english', product: opts.product ?? 'iba', batch: opts.batch ?? null,
    scheduledAt: opts.date, durationMinutes: 60, status: opts.status ?? 'completed', createdBy: 1,
  }).returning();
  return row.id;
}

beforeEach(async () => {
  ctx = makeAttendanceTestDb();
  await createAttendanceFixtureSchema(ctx.client);
});

describe('computeStudentAttendanceSummary', () => {
  it('a student with 3 expected completed classes, attended 2 -> 1 absence', async () => {
    const s1 = await seedSession({ date: new Date('2026-07-01') });
    await seedSession({ date: new Date('2026-07-08') });
    const s3 = await seedSession({ date: new Date('2026-07-15') });

    await ctx.db.insert(classAttendance).values([
      { sessionId: s1, userId: 42, joinedAt: new Date(), mode: 'offline', source: 'manual' },
      { sessionId: s3, userId: 42, joinedAt: new Date(), mode: 'online', source: 'pulled' },
    ]);

    const [summary] = await computeStudentAttendanceSummary(
      ctx.db, { id: 42, batch: null, products: ['iba'] }, NOW,
    );
    expect(summary.totalExpected).toBe(3);
    expect(summary.absences).toBe(1);
    expect(summary.onlineUsed).toBe(1);
    expect(summary.onlineRemaining).toBe(7);
  });

  it('a scheduled (not-yet-happened) class is not counted as expected', async () => {
    await seedSession({ date: new Date('2026-07-01') });
    await seedSession({ date: new Date('2026-09-01'), status: 'scheduled' }); // future

    const [summary] = await computeStudentAttendanceSummary(
      ctx.db, { id: 1, batch: null, products: ['iba'] }, NOW,
    );
    expect(summary.totalExpected).toBe(1);
  });

  it('onlineRemaining floors at 0 even if a student is somehow over the cap', async () => {
    const sessions: number[] = [];
    for (let i = 0; i < 9; i++) sessions.push(await seedSession({ date: new Date(2026, 6, 1 + i) }));
    await ctx.db.insert(classAttendance).values(
      sessions.map((sessionId) => ({ sessionId, userId: 7, joinedAt: new Date(), mode: 'online' as const, source: 'manual' as const })),
    );

    const [summary] = await computeStudentAttendanceSummary(
      ctx.db, { id: 7, batch: null, products: ['iba'] }, NOW,
    );
    expect(summary.onlineUsed).toBe(9);
    expect(summary.onlineRemaining).toBe(0);
  });

  it('one entry per product the student holds, and other products don\'t leak in', async () => {
    await seedSession({ date: new Date('2026-07-01'), product: 'iba' });
    await seedSession({ date: new Date('2026-07-01'), product: 'fbs' });

    const summaries = await computeStudentAttendanceSummary(
      ctx.db, { id: 1, batch: null, products: ['iba', 'fbs'] }, NOW,
    );
    expect(summaries.map((s) => s.product).sort()).toEqual(['fbs', 'iba']);
    expect(summaries.find((s) => s.product === 'iba')?.totalExpected).toBe(1);
    expect(summaries.find((s) => s.product === 'fbs')?.totalExpected).toBe(1);
  });

  it('a batch-scoped class only counts for a student in that batch', async () => {
    await seedSession({ date: new Date('2026-07-01'), batch: '2026-27' });
    await seedSession({ date: new Date('2026-07-02'), batch: '2025-26' });
    await seedSession({ date: new Date('2026-07-03'), batch: null }); // all batches

    const [summary] = await computeStudentAttendanceSummary(
      ctx.db, { id: 1, batch: '2026-27', products: ['iba'] }, NOW,
    );
    expect(summary.totalExpected).toBe(2); // the matching batch + the all-batches one
  });

  it('no products -> empty array, not a crash', async () => {
    const summaries = await computeStudentAttendanceSummary(ctx.db, { id: 1, batch: null, products: [] }, NOW);
    expect(summaries).toEqual([]);
  });
});

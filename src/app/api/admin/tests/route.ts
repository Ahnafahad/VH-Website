/**
 * GET /api/admin/tests
 * Staff (admin/instructor) listing: all tests incl. drafts, windows with
 * effective state, attempt counts.
 */

import { safeApiHandler } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { effectiveWindowState } from '@/lib/tests/windows';
import { db } from '@/lib/db';
import { tests, testWindows, testAttempts } from '@/lib/db/schema';
import { inArray, sql } from 'drizzle-orm';

export async function GET() {
  return safeApiHandler(async () => {
    await requireStaff();
    const now = new Date();

    const rows = await db.select().from(tests);
    if (rows.length === 0) return { tests: [] };
    const testIds = rows.map(t => t.id);

    const [windows, counts] = await Promise.all([
      db.select().from(testWindows).where(inArray(testWindows.testId, testIds)),
      db.select({
        testId: testAttempts.testId,
        status: testAttempts.status,
        count: sql<number>`count(*)`.mapWith(Number),
      }).from(testAttempts)
        .where(inArray(testAttempts.testId, testIds))
        .groupBy(testAttempts.testId, testAttempts.status),
    ]);

    return {
      tests: rows.map(t => ({
        id: t.id,
        slug: t.slug,
        title: t.title,
        bucket: t.bucket,
        status: t.status,
        totalQuestions: t.totalQuestions,
        totalMarks: t.totalMarks,
        allowedProducts: t.allowedProducts ? JSON.parse(t.allowedProducts) : null,
        resultsPublishedAt: t.resultsPublishedAt?.getTime() ?? null,
        createdAt: t.createdAt.getTime(),
        windows: windows
          .filter(w => w.testId === t.id)
          .sort((a, b) => a.opensAt.getTime() - b.opensAt.getTime())
          .map(w => ({
            id: w.id,
            mode: w.mode,
            opensAt: w.opensAt.getTime(),
            closesAt: w.closesAt.getTime(),
            durationMinutes: w.durationMinutes,
            status: w.status,
            state: effectiveWindowState(w, now),
          })),
        attemptCounts: {
          inProgress: counts.find(c => c.testId === t.id && c.status === 'in_progress')?.count ?? 0,
          submitted: counts.find(c => c.testId === t.id && c.status === 'submitted')?.count ?? 0,
          banned: counts.find(c => c.testId === t.id && c.status === 'banned')?.count ?? 0,
        },
      })),
    };
  });
}

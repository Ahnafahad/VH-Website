/**
 * GET /api/fbs-diagnosis
 * Public listing of the FBS diagnostic assessments (isDiagnostic tests, hidden
 * from the normal /tests page). Works signed-out (attempt=null) and signed-in
 * (includes the caller's attempt status per test). Never leaks answer keys.
 */

import { NextRequest } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { getServerSession } from 'next-auth/next';
import { db } from '@/lib/db';
import { tests, testWindows, testAttempts } from '@/lib/db/schema';
import { authOptions } from '@/lib/auth';
import { getUserByEmail } from '@/lib/db-access-control';
import { safeApiHandler } from '@/lib/api-utils';

export async function GET(_req: NextRequest) {
  return safeApiHandler(async () => {
    const rows = await db.select().from(tests).where(
      and(eq(tests.status, 'published'), eq(tests.isDiagnostic, true)),
    );
    if (rows.length === 0) return { tests: [] };

    const testIds = rows.map(t => t.id);
    const windows = await db.select().from(testWindows)
      .where(inArray(testWindows.testId, testIds));

    // Optional identity — signed-out callers still get the list (attempt=null).
    let userId: number | null = null;
    try {
      const session = await getServerSession(authOptions);
      const email = session?.user?.email;
      if (email) {
        const user = await getUserByEmail(email);
        userId = user?.id ?? null;
      }
    } catch {
      userId = null;
    }

    const attempts = userId != null
      ? await db.select().from(testAttempts).where(
          and(inArray(testAttempts.testId, testIds), eq(testAttempts.userId, userId)),
        )
      : [];

    const ordered = [...rows].sort((a, b) => a.slug.localeCompare(b.slug));

    return {
      tests: ordered.map(t => {
        const onlineWindow = windows.find(w => w.testId === t.id && w.mode === 'online');
        const attempt = attempts.find(a => a.testId === t.id) ?? null;
        return {
          slug: t.slug,
          title: t.title,
          totalQuestions: t.totalQuestions,
          totalMarks: t.totalMarks,
          durationMinutes: onlineWindow?.durationMinutes ?? null,
          windowId: onlineWindow?.id ?? null,
          attempt: attempt && {
            status: attempt.status,
            submittedAt: attempt.submittedAt?.getTime() ?? null,
          },
        };
      }),
    };
  });
}

/**
 * POST /api/tests/[slug]/violation
 * Reports a tab-leave for the caller's in-progress attempt. The server owns
 * the escalation ladder:
 *   1st  → warning
 *   2nd  → progress reset (answers wiped; timer keeps running)
 *   3rd  → banned from this test (admin can reinstate)
 * Returns { action, tabLeaveCount }.
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { testAnswers, testAttempts, testViolations } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser, requireTestForUser } from '@/lib/tests/route-helpers';
import { getUserAttempt } from '@/lib/tests/service';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const { slug } = await params;
    const { test } = await requireTestForUser(slug, user);

    const attempt = await getUserAttempt(test.id, user.id);
    if (!attempt || attempt.status !== 'in_progress') {
      throw new ApiException('No in-progress attempt', 409, 'NO_ATTEMPT');
    }

    const count = attempt.tabLeaveCount + 1;
    const action: 'warning' | 'reset' | 'ban' =
      count === 1 ? 'warning' : count === 2 ? 'reset' : 'ban';

    await db.insert(testViolations).values({
      attemptId: attempt.id,
      type: 'tab_leave',
      action,
    });

    if (action === 'warning') {
      await db.update(testAttempts)
        .set({ tabLeaveCount: count })
        .where(eq(testAttempts.id, attempt.id));
    } else if (action === 'reset') {
      await db.delete(testAnswers).where(eq(testAnswers.attemptId, attempt.id));
      await db.update(testAttempts)
        .set({ tabLeaveCount: count, resetCount: attempt.resetCount + 1 })
        .where(eq(testAttempts.id, attempt.id));
    } else {
      await db.update(testAttempts)
        .set({ tabLeaveCount: count, status: 'banned', bannedAt: new Date() })
        .where(eq(testAttempts.id, attempt.id));
    }

    return { action, tabLeaveCount: count };
  });
}

/**
 * POST /api/admin/tests/attempts/[attemptId]
 * Staff actions on a single attempt.
 * Body: { action: 'reset' | 'unban' }
 *   reset → wipes answers + score, returns attempt to a fresh state so the
 *           student can start again (violation counters cleared).
 *   unban → clears the ban but keeps answers; student resumes in progress.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { testAttempts, testAnswers } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';

const bodySchema = z.object({ action: z.enum(['reset', 'unban']) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  return safeApiHandler(async () => {
    await requireStaff();
    const attemptId = parseInt((await params).attemptId, 10);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiException('Invalid body', 400);

    const attempt = await db.select().from(testAttempts)
      .where(eq(testAttempts.id, attemptId)).get();
    if (!attempt) throw new ApiException('Attempt not found', 404);

    if (parsed.data.action === 'reset') {
      await db.delete(testAnswers).where(eq(testAnswers.attemptId, attemptId));
      await db.delete(testAttempts).where(eq(testAttempts.id, attemptId));
      return { reset: true };
    }

    // unban
    if (attempt.status !== 'banned') throw new ApiException('Attempt is not banned', 409);
    await db.update(testAttempts).set({
      status: 'in_progress',
      bannedAt: null,
      // stays at the ban threshold: one more tab-leave re-bans immediately
      tabLeaveCount: 2,
    }).where(eq(testAttempts.id, attemptId));

    return { unbanned: true };
  });
}

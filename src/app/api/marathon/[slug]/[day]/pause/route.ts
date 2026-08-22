/**
 * POST /api/marathon/[slug]/[day]/pause
 * Body: { action: 'pause' | 'resume' }
 * Self-serve stopwatch pause — capped at 2 uses per day, enforced here.
 * There's no anti-cheat ban ladder on marathon days (this is practice, not a
 * proctored exam); pause is the only session-control mechanic.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser, requireUnlockedDayForUser } from '@/lib/marathon/route-helpers';
import { requireInProgressAttempt, pauseAttempt, resumeAttempt } from '@/lib/marathon/service';

const bodySchema = z.object({ action: z.enum(['pause', 'resume']) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; day: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const { slug, day } = await params;
    const dayNumber = Number(day);
    if (!Number.isInteger(dayNumber) || dayNumber < 1) throw new ApiException('Invalid day', 400);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiException('Invalid body', 400);

    const { day: dayRow } = await requireUnlockedDayForUser(slug, dayNumber, user);
    const attempt = await requireInProgressAttempt(dayRow.id, user.id);

    if (parsed.data.action === 'pause') {
      const { pausedAt, pauseCount } = await pauseAttempt(attempt);
      return { pausedAt: pausedAt.getTime(), pauseCount };
    }
    await resumeAttempt(attempt);
    return { pausedAt: null, pauseCount: attempt.pauseCount };
  });
}

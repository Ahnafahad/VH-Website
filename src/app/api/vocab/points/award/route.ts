/**
 * POST /api/vocab/points/award
 *
 * Internal endpoint — awards points to the authenticated user.
 * All scoring must be server-side; this endpoint is the single gateway.
 *
 * Body:   { amount: number }
 * Returns { ok: true, totalPoints: number }
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, users, vocabUserProgress } from '@/lib/db';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';
import { awardPoints } from '@/lib/vocab/points';

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();

    const body = await req.json() as unknown;
    if (typeof body !== 'object' || body === null) {
      throw new ApiException('Invalid body', 400);
    }
    const { amount } = body as Record<string, unknown>;
    if (typeof amount !== 'number' || amount <= 0 || amount > 1000) {
      throw new ApiException('amount must be a positive integer ≤ 1000', 400);
    }

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!user) throw new ApiException('User not found', 404);

    await awardPoints(user.id, Math.floor(amount));

    const [progress] = await db
      .select({ totalPoints: vocabUserProgress.totalPoints })
      .from(vocabUserProgress)
      .where(eq(vocabUserProgress.userId, user.id))
      .limit(1);

    return { ok: true, totalPoints: progress?.totalPoints ?? 0 };
  });
}

/**
 * POST /api/admin/leaderboard/reset
 *
 * Admin-only endpoint.
 * 1. Reads the top 3 users by totalPoints from vocab_user_progress.
 * 2. Saves them to vocab_hall_of_fame with the provided sessionLabel.
 * 3. Zeros all totalPoints in vocab_user_progress.
 *
 * Body: { sessionLabel: string }
 * Returns: { success: true, savedEntries: number }
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, vocabUserProgress, vocabHallOfFame } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';

async function requireAdmin(): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    throw new ApiException('Admin access required', 403);
  }
}

const bodySchema = z.object({
  sessionLabel: z.string().min(1, 'Session label is required').max(120),
});

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    await requireAdmin();

    const body   = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiException(parsed.error.issues[0]?.message ?? 'Invalid body', 400);
    }

    const { sessionLabel } = parsed.data;
    const now              = new Date();

    // ── 1. Fetch top 3 by totalPoints ────────────────────────────────────────
    const top3 = await db
      .select({
        userId:      vocabUserProgress.userId,
        totalPoints: vocabUserProgress.totalPoints,
        userName:    users.name,
      })
      .from(vocabUserProgress)
      .innerJoin(users, eq(vocabUserProgress.userId, users.id))
      .orderBy(desc(vocabUserProgress.totalPoints))
      .limit(3);

    // ── 2. Save to Hall of Fame ───────────────────────────────────────────────
    if (top3.length > 0) {
      const hofRows = top3.map((entry, idx) => ({
        sessionLabel,
        rank:        idx + 1,
        userId:      entry.userId,
        displayName: entry.userName ?? 'Anonymous',
        points:      entry.totalPoints ?? 0,
        weekEndDate: now,
        createdAt:   now,
      }));

      await db.insert(vocabHallOfFame).values(hofRows);
    }

    // ── 3. Zero all totalPoints ───────────────────────────────────────────────
    await db
      .update(vocabUserProgress)
      .set({ totalPoints: 0, updatedAt: now });

    return { success: true, savedEntries: top3.length };
  });
}

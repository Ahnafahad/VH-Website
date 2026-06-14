/**
 * POST /api/admin/vocab/reset-onboarding
 *
 * Superadmin-only. Resets onboardingComplete to false for a single user so
 * they re-see the onboarding flow on next visit while keeping all vocab
 * progress (SRS records, points, streaks, badges) intact.
 *
 * Body: { userId: number }
 * Returns: { success: true }
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { vocabUserProgress } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';

async function requireAdmin(): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    throw new ApiException('Admin access required', 403);
  }
}

const bodySchema = z.object({
  userId: z.number().int().positive(),
});

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    await requireAdmin();

    const body   = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiException(parsed.error.issues[0]?.message ?? 'Invalid body', 400);
    }

    const { userId } = parsed.data;

    await db
      .update(vocabUserProgress)
      .set({ onboardingComplete: false, updatedAt: new Date() })
      .where(eq(vocabUserProgress.userId, userId));

    return { success: true };
  });
}

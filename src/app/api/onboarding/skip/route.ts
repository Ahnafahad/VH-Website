import { NextResponse } from 'next/server';
import { db, users } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';
import { validateAuth, createErrorResponse, ApiException } from '@/lib/api-utils';
import { clearAccessControlCache } from '@/lib/db-access-control';

const MAX_SKIPS = 3;

export async function POST() {
  try {
    const auth = await validateAuth();

    const row = await db
      .select({ id: users.id, onboardingSkips: users.onboardingSkips })
      .from(users)
      .where(eq(users.email, auth.email.toLowerCase()))
      .get();

    if (!row) throw new ApiException('User not found', 404);
    if (row.onboardingSkips >= MAX_SKIPS) {
      throw new ApiException('Skip limit reached', 409);
    }

    await db
      .update(users)
      .set({ onboardingSkips: sql`${users.onboardingSkips} + 1`, updatedAt: new Date() })
      .where(eq(users.id, row.id));

    clearAccessControlCache(auth.email);

    return NextResponse.json({
      success: true,
      skips: row.onboardingSkips + 1,
      remaining: MAX_SKIPS - (row.onboardingSkips + 1),
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}

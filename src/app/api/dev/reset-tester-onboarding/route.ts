/**
 * GET /api/dev/reset-tester-onboarding
 *
 * DEV ONLY (404s in production, same gate as /dev-login). Visiting this URL
 * resets the fixed tester account's onboarding flag, signs them out, and
 * drops them back on /lexicore — so the full anonymous → auth → onboarding
 * flow can be replayed from scratch as many times as needed while iterating.
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, users, vocabUserProgress } from '@/lib/db';

const TESTER_EMAIL = 'ahnafahad16@gmail.com';

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return new NextResponse(null, { status: 404 });
  }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, TESTER_EMAIL))
    .limit(1);

  if (user) {
    await db
      .insert(vocabUserProgress)
      .values({ userId: user.id, phase: 1, dailyTarget: 5, onboardingComplete: false })
      .onConflictDoUpdate({
        target: vocabUserProgress.userId,
        set:    { onboardingComplete: false, updatedAt: new Date() },
      });
  }

  const response = NextResponse.redirect(new URL('/lexicore', req.url));
  // Clear both the plain and secure-cookie session-token names — dev runs on
  // http (plain), but covers the bases if that ever changes locally.
  response.cookies.delete('next-auth.session-token');
  response.cookies.delete('__Secure-next-auth.session-token');
  return response;
}

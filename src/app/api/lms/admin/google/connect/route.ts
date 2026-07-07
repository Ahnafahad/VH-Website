/**
 * GET /api/lms/admin/google/connect
 * Initiates the host-only Google Calendar OAuth flow.
 * Generates a nonce (state), stores it in a short-lived httpOnly cookie,
 * then redirects to Google's consent screen.
 *
 * CRITICAL: This is separate from the NextAuth GoogleProvider.
 * Calendar scope NEVER enters the student login flow.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { requireStaff } from '@/lib/tests/route-helpers';
import { getAuthUrl } from '@/lib/google/calendar';

export async function GET() {
  try {
    await requireStaff();
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const state = randomUUID();

  // Store state in a short-lived httpOnly cookie (10 minutes)
  const cookieStore = await cookies();
  cookieStore.set('google_oauth_state', state, {
    httpOnly:  true,
    secure:    process.env.NODE_ENV === 'production',
    sameSite:  'lax',
    maxAge:    600, // 10 minutes
    path:      '/',
  });

  const authUrl = getAuthUrl(state);
  return NextResponse.redirect(authUrl);
}

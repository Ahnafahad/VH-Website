/**
 * GET /api/lms/admin/google/callback
 * Handles the OAuth2 callback from Google.
 * Verifies the state cookie, exchanges the code for tokens,
 * upserts the single google_credentials row (single-host invariant).
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireStaff } from '@/lib/tests/route-helpers';
import { exchangeCode } from '@/lib/google/calendar';
import { db } from '@/lib/db';
import { googleCredentials } from '@/lib/db/schema';

export async function GET(req: NextRequest) {
  // Auth check
  let staff: Awaited<ReturnType<typeof requireStaff>>;
  try {
    staff = await requireStaff();
  } catch {
    return NextResponse.redirect(new URL('/admin/settings/google?error=unauthorized', req.url));
  }

  const url   = new URL(req.url);
  const code  = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      new URL(`/admin/settings/google?error=${encodeURIComponent(error)}`, req.url),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/admin/settings/google?error=missing_params', req.url));
  }

  // Verify state cookie
  const cookieStore = await cookies();
  const storedState = cookieStore.get('google_oauth_state')?.value;

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(new URL('/admin/settings/google?error=state_mismatch', req.url));
  }

  // Clear state cookie
  cookieStore.delete('google_oauth_state');

  try {
    const tokens = await exchangeCode(code);

    // Enforce single-host invariant: delete all existing rows first
    await db.delete(googleCredentials);

    // Insert fresh row for this admin
    await db.insert(googleCredentials).values({
      userId:       staff.id,
      accessToken:  tokens.accessToken,
      // Preserve non-empty refresh token; Google only returns it on first consent
      refreshToken: tokens.refreshToken || '',
      expiresAt:    tokens.expiresAt,
      scope:        tokens.scope,
      updatedAt:    new Date(),
    });

    return NextResponse.redirect(new URL('/admin/settings/google?connected=1', req.url));
  } catch (err) {
    console.error('[Google OAuth callback] Error exchanging code:', err);
    return NextResponse.redirect(new URL('/admin/settings/google?error=exchange_failed', req.url));
  }
}

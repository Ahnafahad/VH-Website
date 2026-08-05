/**
 * /api/admin/announcements
 *
 * POST — Send an announcement email to a targeted audience. Admin-only.
 *        Validates session role server-side. Audience is resolved through the
 *        shared resolver (src/lib/audience/resolve.ts) — the same one the LMS
 *        announcement feed's push notifications use — so this system and the
 *        in-app feed never drift onto two different "who gets this" rules.
 *
 * GET  — Returns a lightweight summary: recipient count for a given audience
 *        selection (defaults to "everyone", matching the original behaviour
 *        before targeting existed). (No announcements log table exists yet —
 *        returns placeholder history.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { sendAdminAnnouncement } from '@/lib/email';
import { isAdminRole } from '@/lib/auth/roles';
import { resolveAudience, isAudienceProduct, type AudienceSelection } from '@/lib/audience/resolve';

// ─── Zod schema ───────────────────────────────────────────────────────────────

const audienceSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('everyone') }),
  z.object({
    mode:    z.literal('batchProduct'),
    product: z.enum(['iba', 'fbs', 'fbs_detailed']),
    batch:   z.string().nullable(),
  }),
  z.object({
    mode:    z.literal('individuals'),
    userIds: z.array(z.number().int()).min(1, 'Select at least one recipient'),
  }),
]);

const announcementSchema = z.object({
  subject: z
    .string()
    .min(1, 'Subject is required')
    .max(100, 'Subject must be 100 characters or fewer'),
  body: z
    .string()
    .min(1, 'Body is required')
    .max(5000, 'Body must be 5 000 characters or fewer'),
  audience: audienceSchema.default({ mode: 'everyone' }),
});

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) };
  }

  const role = (session.user as { role?: string }).role;
  if (!isAdminRole(role)) {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }

  return {
    email:     session.user.email,
    adminName: session.user.name ?? 'Admin',
  };
}

// ─── Query-string → AudienceSelection ──────────────────────────────────────────

function audienceFromSearchParams(searchParams: URLSearchParams): AudienceSelection | { error: string } {
  const mode = searchParams.get('mode') ?? 'everyone';

  if (mode === 'everyone') return { mode: 'everyone' };

  if (mode === 'batchProduct') {
    const product = searchParams.get('product');
    if (!isAudienceProduct(product)) return { error: 'product must be one of iba, fbs, fbs_detailed' };
    const batch = searchParams.get('batch');
    return { mode: 'batchProduct', product, batch: batch ? batch : null };
  }

  if (mode === 'individuals') {
    const raw = searchParams.get('userIds') ?? '';
    const userIds = raw.split(',').filter(Boolean).map(Number).filter(n => Number.isInteger(n));
    return { mode: 'individuals', userIds };
  }

  return { error: `Unknown mode: ${mode}` };
}

// ─── GET /api/admin/announcements ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const audience = audienceFromSearchParams(req.nextUrl.searchParams);
  if ('error' in audience) {
    return NextResponse.json({ error: audience.error }, { status: 400 });
  }

  try {
    const recipients = await resolveAudience(db, audience);

    return NextResponse.json({
      recipientCount: recipients.length,
      // No log table exists yet — return empty history
      history:        [],
    });
  } catch (err) {
    console.error('[GET /api/admin/announcements]', err);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

// ─── POST /api/admin/announcements ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  // ── Parse + validate body ─────────────────────────────────────────────────
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = announcementSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { subject, body, audience } = parsed.data;

  // ── Collect recipient emails via the shared audience resolver ─────────────
  let recipientEmails: string[];
  try {
    const recipients = await resolveAudience(db, audience);
    recipientEmails = recipients.map(r => r.email).filter(Boolean);
  } catch (err) {
    console.error('[POST /api/admin/announcements] DB error resolving audience:', err);
    return NextResponse.json({ error: 'Failed to resolve recipients' }, { status: 500 });
  }

  if (recipientEmails.length === 0) {
    return NextResponse.json({ error: 'No active recipients found for the selected audience' }, { status: 422 });
  }

  // ── Send emails ───────────────────────────────────────────────────────────
  const result = await sendAdminAnnouncement(recipientEmails, {
    subject,
    body,
    adminName: auth.adminName,
  });

  return NextResponse.json({
    success:  result.success,
    failed:   result.failed,
    total:    result.total,
    sentAt:   new Date().toISOString(),
  });
}

/**
 * /api/admin/announcements
 *
 * POST — Send an announcement email to all active users.
 *        Admin-only. Validates session role server-side.
 *
 * GET  — Returns a lightweight summary: total user count eligible to receive
 *        announcements. (No announcements log table exists yet — returns
 *        placeholder history.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { z } from 'zod';
import { eq, ne } from 'drizzle-orm';

import { authOptions } from '@/lib/auth';
import { db, users } from '@/lib/db';
import { sendAdminAnnouncement } from '@/lib/email';

// ─── Zod schema ───────────────────────────────────────────────────────────────

const announcementSchema = z.object({
  subject: z
    .string()
    .min(1, 'Subject is required')
    .max(100, 'Subject must be 100 characters or fewer'),
  body: z
    .string()
    .min(1, 'Body is required')
    .max(5000, 'Body must be 5 000 characters or fewer'),
});

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) };
  }

  const role = (session.user as { role?: string }).role;
  if (role !== 'admin' && role !== 'super_admin') {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }

  return {
    email:     session.user.email,
    adminName: session.user.name ?? 'Admin',
  };
}

// ─── GET /api/admin/announcements ─────────────────────────────────────────────

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  try {
    // Count all active, non-suspended users (exclude super_admin for email lists)
    const allUsers = await db
      .select({ email: users.email })
      .from(users)
      .where(ne(users.status, 'inactive'));

    return NextResponse.json({
      recipientCount: allUsers.length,
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

  const { subject, body } = parsed.data;

  // ── Collect recipient emails ───────────────────────────────────────────────
  // Include all users whose status is not 'inactive'.
  // We intentionally include all roles (student, admin, super_admin) so the
  // admin-only broadcast reaches every active account.
  let recipientEmails: string[];
  try {
    const rows = await db
      .select({ email: users.email })
      .from(users)
      .where(ne(users.status, 'inactive'));

    recipientEmails = rows.map(r => r.email).filter(Boolean);
  } catch (err) {
    console.error('[POST /api/admin/announcements] DB error fetching emails:', err);
    return NextResponse.json({ error: 'Failed to fetch recipients' }, { status: 500 });
  }

  if (recipientEmails.length === 0) {
    return NextResponse.json({ error: 'No active recipients found' }, { status: 422 });
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

/**
 * GET /api/admin/nav-badges — live counts for the admin sidebar / phone nav.
 * Staff-only (admin, super_admin, instructor). Counts are global, not per-user, so one
 * short-TTL cache entry serves everyone; the sidebar fetches this after first paint.
 */

import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { and, count, eq, gte, inArray, lt } from 'drizzle-orm';
import { validateAuth, ApiException, createErrorResponse } from '@/lib/api-utils';
import { getUserByEmail } from '@/lib/db-access-control';
import { isStaffRole } from '@/lib/auth/roles';
import { db } from '@/lib/db';
import {
  assignmentSubmissions, essaySubmissions, registrations, vocabErrorLogs,
  sessionRequests, classSessions,
} from '@/lib/db/schema';
import type { NavBadges } from '@/components/admin/admin-nav';

const DAY_MS = 24 * 60 * 60 * 1000;

async function n(q: Promise<{ c: number }[]>): Promise<number> {
  return (await q)[0]?.c ?? 0;
}

const loadBadges = unstable_cache(
  async (): Promise<NavBadges> => {
    const now = Date.now();
    const [homework, enrolments, enrolmentsStale, essays, errors, bookings, live] = await Promise.all([
      n(db.select({ c: count() }).from(assignmentSubmissions).where(eq(assignmentSubmissions.status, 'submitted'))),
      n(db.select({ c: count() }).from(registrations).where(eq(registrations.status, 'pending'))),
      n(db.select({ c: count() }).from(registrations).where(and(
        inArray(registrations.status, ['pending', 'contacted']), lt(registrations.createdAt, new Date(now - 14 * DAY_MS)),
      ))),
      n(db.select({ c: count() }).from(essaySubmissions).where(and(
        eq(essaySubmissions.status, 'submitted'), eq(essaySubmissions.isReference, false),
      ))),
      n(db.select({ c: count() }).from(vocabErrorLogs).where(and(
        eq(vocabErrorLogs.severity, 'error'), gte(vocabErrorLogs.createdAt, new Date(now - DAY_MS).toISOString()),
      ))),
      n(db.select({ c: count() }).from(sessionRequests).where(eq(sessionRequests.status, 'pending'))),
      db.select({
        title: classSessions.title, subject: classSessions.subject,
        scheduledAt: classSessions.scheduledAt, durationMinutes: classSessions.durationMinutes,
      }).from(classSessions).where(eq(classSessions.status, 'live')).limit(1),
    ]);
    const l = live[0];
    return {
      homework, enrolments, enrolmentsStale, essays, errors, bookings,
      live: l ? { title: l.title, subject: l.subject, endsAt: l.scheduledAt.getTime() + l.durationMinutes * 60_000 } : null,
    };
  },
  ['admin-nav-badges'],
  { revalidate: 60 },
);

export async function GET() {
  try {
    const auth = await validateAuth();
    const user = await getUserByEmail(auth.email);
    if (!user || !isStaffRole(user.role)) throw new ApiException('Unauthorized', 403);
    return NextResponse.json(await loadBadges());
  } catch (error) {
    return createErrorResponse(error);
  }
}

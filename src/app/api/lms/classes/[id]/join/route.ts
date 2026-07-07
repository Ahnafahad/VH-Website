/**
 * POST /api/lms/classes/[id]/join
 *
 * Algorithm C implementation (server-side):
 * 1. requireUser → load session row (404 if missing/draft/cancelled)
 * 2. Scope check (canAccessLmsContent; staff bypass)
 * 3. Server-side isJoinOpen re-check → 403 JOIN_CLOSED
 * 4. No meetLink → 409 NO_LINK
 * 5. Upsert classAttendance (UNIQUE sessionId+userId, onConflictDoNothing)
 * 6. Return { meetLink }
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { classSessions, classAttendance } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { canAccessLmsContent } from '@/lib/lms/access';
import { isJoinOpen } from '@/lib/lms/join-window';
import { isTestStaff } from '@/lib/tests/access';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const { id } = await params;
    const sessionId = parseInt(id, 10);
    if (isNaN(sessionId)) throw new ApiException('Invalid id', 400);

    // Load the class session
    const session = await db
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, sessionId))
      .get();

    if (!session) throw new ApiException('Class not found', 404, 'NOT_FOUND');

    // Draft or cancelled sessions are not joinable
    if (session.status === 'draft' || session.status === 'cancelled') {
      throw new ApiException('Class not found', 404, 'NOT_FOUND');
    }

    // Access scope check (staff always pass)
    const staff = isTestStaff(user);
    if (!staff) {
      const hasAccess = canAccessLmsContent(user, {
        product: session.product,
        batch:   session.batch,
      });
      if (!hasAccess) {
        throw new ApiException('Access denied', 403, 'ACCESS_DENIED');
      }
    }

    // Server-side join-window check (Algorithm C re-check — never trust client)
    const now = new Date();
    if (!isJoinOpen({ scheduledAt: session.scheduledAt, durationMinutes: session.durationMinutes }, now)) {
      throw new ApiException('Join window is not open', 403, 'JOIN_CLOSED');
    }

    // Must have a meet link
    if (!session.meetLink) {
      throw new ApiException('No Meet link available yet', 409, 'NO_LINK');
    }

    // Upsert attendance (first join only; subsequent joins are no-ops)
    await db
      .insert(classAttendance)
      .values({
        sessionId: session.id,
        userId:    user.id,
        joinedAt:  now,
      })
      .onConflictDoNothing();

    return { meetLink: session.meetLink };
  });
}

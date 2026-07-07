/**
 * GET /api/lms/admin/booking/requests
 * Returns all session requests, newest first, with requester name joined.
 */

import { NextRequest } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { sessionRequests, users } from '@/lib/db/schema';
import { safeApiHandler } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { eq } from 'drizzle-orm';

export async function GET(_req: NextRequest) {
  return safeApiHandler(async () => {
    await requireStaff();

    const rows = await db
      .select({
        request: sessionRequests,
        userName:  users.name,
        userEmail: users.email,
      })
      .from(sessionRequests)
      .leftJoin(users, eq(sessionRequests.userId, users.id))
      .orderBy(desc(sessionRequests.createdAt));

    return rows.map((r) => ({
      id:              r.request.id,
      userId:          r.request.userId,
      userName:        r.userName ?? 'Unknown',
      userEmail:       r.userEmail ?? '',
      subject:         r.request.subject,
      topic:           r.request.topic,
      preferredMode:   r.request.preferredMode,
      durationMinutes: r.request.durationMinutes,
      notes:           r.request.notes,
      status:          r.request.status,
      resolvedSlotId:  r.request.resolvedSlotId,
      staffNote:       r.request.staffNote,
      createdAt:       r.request.createdAt.getTime(),
    }));
  });
}

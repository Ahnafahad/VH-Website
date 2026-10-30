/**
 * POST /api/lms/admin/booking/requests/[id]/resolve — instructor answers a request.
 *   { action: 'accept', startAt, mode?, location? }          take one of the student's times
 *   { action: 'propose', proposals: [{startAt, endAt?}], mode?, location? }
 *                                                            counter with times / ranges (endAt = range)
 *   { action: 'decline', note? }
 *   { action: 'cancel' }                                     cancel a confirmed session
 * `mode` is required only when the student chose "either"; `location` for in-person.
 * Accepting creates the Meet link (online) or calendar event (in person).
 */

import { NextRequest } from 'next/server';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { staffAct } from '@/lib/booking/service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    const staff = await requireStaff();
    const id = Number((await params).id);
    if (!Number.isInteger(id)) throw new ApiException('Invalid request id', 400);
    return staffAct(staff, id, await req.json());
  });
}

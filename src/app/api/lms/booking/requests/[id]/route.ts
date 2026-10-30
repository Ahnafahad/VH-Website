/**
 * POST /api/lms/booking/requests/[id] — the student answers their own request.
 *   { action: 'accept', startAt }          pick one of the instructor's times (or a start inside a range)
 *   { action: 'counter', preferredTimes }  none of those work — suggest new times
 *   { action: 'cancel' }                   withdraw the request / cancel a confirmed session (>2h before)
 */

import { NextRequest } from 'next/server';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { studentAct } from '@/lib/booking/service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    const me = await requireUser();
    const id = Number((await params).id);
    if (!Number.isInteger(id)) throw new ApiException('Invalid request id', 400);
    return studentAct(me, id, await req.json());
  });
}

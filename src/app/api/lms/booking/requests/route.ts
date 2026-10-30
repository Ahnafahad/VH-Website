/**
 * GET  /api/lms/booking/requests — my requests (with proposals / confirmed details)
 * POST /api/lms/booking/requests — ask for a 1-on-1 session, offering a few times
 *   body: { subject, topic, preferredMode, durationMinutes, notes?, preferredTimes: number[] (epoch ms) }
 */

import { NextRequest } from 'next/server';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { isStaffRole } from '@/lib/auth/roles';
import { createRequest, listMine } from '@/lib/booking/service';

async function requireLmsUser() {
  const me = await requireUser();
  if (!isStaffRole(me.role) && me.products.length === 0) {
    throw new ApiException('LMS access required', 403, 'LMS_ACCESS_DENIED');
  }
  return me;
}

export async function GET(_req: NextRequest) {
  return safeApiHandler(async () => listMine(await requireLmsUser()));
}

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const me = await requireLmsUser();
    return createRequest(me, await req.json());
  });
}

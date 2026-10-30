/**
 * GET /api/lms/admin/booking/requests
 * Session requests this staff member can handle: their product(s) only
 * (super admins see all), excluding ones another instructor has claimed.
 */

import { NextRequest } from 'next/server';
import { safeApiHandler } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { listForStaff } from '@/lib/booking/service';

export async function GET(_req: NextRequest) {
  return safeApiHandler(async () => listForStaff(await requireStaff()));
}

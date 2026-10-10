/**
 * POST /api/admin/printdesk/status — { requestIds, status, reason? }
 * status: 'printed' | 'collected' | 'rejected' (reason required) | 'requested' (undo printed).
 */

import { NextRequest } from 'next/server';
import { safeApiHandler } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { setStatus } from '@/lib/printdesk/service';

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const staff = await requireStaff();
    const { requestIds, status, reason } = (await req.json()) as { requestIds?: unknown; status?: unknown; reason?: unknown };
    return setStatus(staff, requestIds, status, reason);
  });
}

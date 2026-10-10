/**
 * POST /api/admin/essays/scripts/[id]/reject — { reason } — sends the script back for resubmission.
 */

import { NextRequest } from 'next/server';
import { safeApiHandler } from '@/lib/api-utils';
import { parseId, requireEssayStaff } from '@/lib/essays/route-helpers';
import { rejectScript } from '@/lib/essays/service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return safeApiHandler(async () => {
    const user = await requireEssayStaff();
    const { reason } = (await req.json()) as { reason?: unknown };
    return rejectScript(parseId((await params).id), user, reason);
  });
}

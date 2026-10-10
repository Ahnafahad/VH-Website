/**
 * POST /api/admin/printdesk/pack — { requestIds } — the print pack (materials,
 * file URLs, who asked). Marks any still-'requested' ones as printed.
 */

import { NextRequest } from 'next/server';
import { safeApiHandler } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { buildPack } from '@/lib/printdesk/service';

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const staff = await requireStaff();
    const { requestIds } = (await req.json()) as { requestIds?: unknown };
    return buildPack(staff, requestIds);
  });
}

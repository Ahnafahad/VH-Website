/**
 * GET  /api/printdesk — the caller's printable materials + their requests.
 * POST /api/printdesk — { materialIds } — new print request (one copy each).
 */

import { NextRequest } from 'next/server';
import { safeApiHandler } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { createRequest, getStudentView } from '@/lib/printdesk/service';

export async function GET() {
  return safeApiHandler(async () => getStudentView(await requireUser()));
}

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const { materialIds } = (await req.json()) as { materialIds?: unknown };
    return createRequest(user, materialIds);
  });
}

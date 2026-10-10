/**
 * POST /api/essays/[seriesId]/submit — finalises one essay.
 * Body: { essayIndex: number; pages: { key, width, height }[] } (pages in order)
 * First submissions close at the deadline; a rejected essay can be resubmitted any time.
 */

import { NextRequest } from 'next/server';
import { safeApiHandler } from '@/lib/api-utils';
import { parseId, requireUser } from '@/lib/essays/route-helpers';
import { submitEssay } from '@/lib/essays/service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ seriesId: string }> }) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const seriesId = parseId((await params).seriesId);
    const body = (await req.json()) as { essayIndex?: number; pages?: unknown };
    return submitEssay(user, seriesId, Number(body.essayIndex), body.pages);
  });
}

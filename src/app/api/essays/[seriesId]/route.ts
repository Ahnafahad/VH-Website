/**
 * GET /api/essays/[seriesId] — series details, the caller's own scripts, and
 * (once published) their marked pages, marks and class stats.
 */

import { safeApiHandler } from '@/lib/api-utils';
import { parseId, requireUser } from '@/lib/essays/route-helpers';
import { getStudentSeriesDetail } from '@/lib/essays/service';

export async function GET(_req: Request, { params }: { params: Promise<{ seriesId: string }> }) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    return getStudentSeriesDetail(user, parseId((await params).seriesId));
  });
}

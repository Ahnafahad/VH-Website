/**
 * GET /api/admin/essays/series/[id]/bundle — every graded script with pages and
 * markings, for the client-side "download all marked scripts" PDF.
 */

import { safeApiHandler } from '@/lib/api-utils';
import { parseId, requireEssayStaff } from '@/lib/essays/route-helpers';
import { getSeriesExportBundle } from '@/lib/essays/service';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return safeApiHandler(async () => {
    await requireEssayStaff();
    return getSeriesExportBundle(parseId((await params).id));
  });
}

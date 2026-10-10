/**
 * GET /api/admin/essays/series/[id]/references — scripts pinned as marking references.
 */

import { safeApiHandler } from '@/lib/api-utils';
import { parseId, requireEssayStaff } from '@/lib/essays/route-helpers';
import { listReferenceScripts } from '@/lib/essays/service';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return safeApiHandler(async () => {
    await requireEssayStaff();
    return { references: await listReferenceScripts(parseId((await params).id)) };
  });
}

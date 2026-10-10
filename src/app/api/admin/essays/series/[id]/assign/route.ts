/**
 * POST /api/admin/essays/series/[id]/assign — assign graders (admins only).
 * Body: { mode: 'split', graderIds } | { mode: 'set', submissionId, graderId|null } | { mode: 'clear' }
 * Assignment is guidance ("Assigned to me" filter); any staff member can still mark any script.
 */

import { NextRequest } from 'next/server';
import { safeApiHandler } from '@/lib/api-utils';
import { parseId, requireEssayAdmin } from '@/lib/essays/route-helpers';
import { assignGraders } from '@/lib/essays/service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return safeApiHandler(async () => {
    await requireEssayAdmin();
    return assignGraders(parseId((await params).id), await req.json());
  });
}

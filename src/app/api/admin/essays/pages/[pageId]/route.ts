/**
 * PUT /api/admin/essays/pages/[pageId] — autosave one page's markings.
 * Body: { annotations: EssayAnnotation[]; rotation?: 0 | 90 | 180 | 270 }
 */

import { NextRequest } from 'next/server';
import { safeApiHandler } from '@/lib/api-utils';
import { parseId, requireEssayStaff } from '@/lib/essays/route-helpers';
import { saveAnnotations } from '@/lib/essays/service';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  return safeApiHandler(async () => {
    const user = await requireEssayStaff();
    const body = (await req.json()) as { annotations?: unknown; rotation?: unknown };
    return saveAnnotations(parseId((await params).pageId), user, body.annotations, body.rotation);
  });
}

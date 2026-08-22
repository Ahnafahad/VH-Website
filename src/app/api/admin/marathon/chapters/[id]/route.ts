/**
 * PATCH /api/admin/marathon/chapters/[id]
 * Body: { status: 'draft' | 'published' }
 * Toggles a chapter's visibility to students. Imported chapters start as
 * 'draft' (see scripts/import-marathon.mjs); flip to 'published' once its
 * content is ready to assign.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser, requireMarathonStaff } from '@/lib/marathon/route-helpers';
import { setChapterStatus } from '@/lib/marathon/service';

const bodySchema = z.object({ status: z.enum(['draft', 'published']) });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    await requireMarathonStaff(user);
    const { id } = await params;
    const chapterId = Number(id);
    if (!Number.isInteger(chapterId) || chapterId < 1) throw new ApiException('Invalid chapter id', 400);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiException('Invalid body', 400);

    await setChapterStatus(chapterId, parsed.data.status);
    return { updated: true };
  });
}

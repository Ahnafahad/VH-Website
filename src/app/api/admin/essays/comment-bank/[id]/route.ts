/**
 * DELETE /api/admin/essays/comment-bank/[id] — own comments; shared ones admins only.
 */

import { safeApiHandler } from '@/lib/api-utils';
import { parseId, requireEssayStaff } from '@/lib/essays/route-helpers';
import { deleteComment } from '@/lib/essays/service';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return safeApiHandler(async () => {
    const user = await requireEssayStaff();
    await deleteComment(user, parseId((await params).id));
    return { ok: true };
  });
}

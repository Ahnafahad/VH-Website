/**
 * PATCH /api/redline/attempts/[attemptId]/responses/[questionId]
 * Adds post-reveal signals: time on the explanation and the transfer-question answer (missed questions only).
 */

import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireRedlineOpen } from '@/lib/redline/route-helpers';
import { patchResponse } from '@/lib/redline/service';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ attemptId: string; questionId: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireRedlineOpen();
    const p = await params;
    const attemptId = Number(p.attemptId);
    const questionId = Number(p.questionId);
    if (!Number.isInteger(attemptId) || !Number.isInteger(questionId)) throw new ApiException('Invalid id', 400);
    const b = await req.json().catch(() => ({}));
    return patchResponse(user.id, attemptId, questionId, {
      transferKey: typeof b.transferKey === 'string' ? b.transferKey : null,
      transferMs: Number(b.transferMs) || 0,
      dwellMs: b.dwellMs === undefined ? undefined : Number(b.dwellMs) || 0,
    });
  });
}

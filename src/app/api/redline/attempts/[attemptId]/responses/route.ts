/**
 * POST /api/redline/attempts/[attemptId]/responses
 * Locks in one answer with its interaction signals; grading and reveal are server-side.
 */

import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireRedlineOpen } from '@/lib/redline/route-helpers';
import { recordResponse } from '@/lib/redline/service';
import type { RedlineSubmitResponse } from '@/lib/redline/types';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireRedlineOpen();
    const attemptId = Number((await params).attemptId);
    if (!Number.isInteger(attemptId)) throw new ApiException('Invalid attempt', 400);
    const b = await req.json();
    const questionId = Number(b?.questionId);
    if (!Number.isInteger(questionId)) throw new ApiException('Invalid question', 400);
    const body: RedlineSubmitResponse = {
      questionId,
      selectedKey: typeof b.selectedKey === 'string' ? b.selectedKey : null,
      confidence: b.confidence ?? null,
      firstClickMs: Number(b.firstClickMs) || 0,
      totalTimeMs: Number(b.totalTimeMs) || 0,
      changes: Array.isArray(b.changes) ? b.changes : [],
      hint1Ms: b.hint1Ms ?? null,
      hint2Ms: b.hint2Ms ?? null,
    };
    return recordResponse(user.id, attemptId, body);
  });
}

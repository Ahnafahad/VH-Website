/**
 * POST /api/sprint/[setId]/attempts
 * Submits an attempt (retakes allowed; only the best is stored). Correctness and
 * totals are recomputed server-side from the submitted answers — the client
 * only ever sends selections + per-question time.
 */

import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireSprintAccess } from '@/lib/sprint/route-helpers';
import { getActiveSet, submitAttempt } from '@/lib/sprint/service';
import type { SprintSubmitAnswer } from '@/lib/sprint/types';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ setId: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireSprintAccess();
    const setId = Number((await params).setId);
    if (!Number.isInteger(setId)) throw new ApiException('Invalid set', 400);

    const set = await getActiveSet(setId);
    if (!set) throw new ApiException('Set not found', 404, 'SET_NOT_FOUND');

    const body = await req.json();
    const answers = body?.answers;
    if (!Array.isArray(answers)) throw new ApiException('Invalid answers', 400);
    const parsed: SprintSubmitAnswer[] = answers.map((a) => ({
      questionId: Number(a?.questionId),
      selectedKey: a?.selectedKey ? String(a.selectedKey) : null,
      timeSpentMs: Number(a?.timeSpentMs) || 0,
    }));

    return submitAttempt(set, user.id, parsed);
  });
}

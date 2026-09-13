/**
 * GET /api/sprint/[setId]
 * Returns the set to take, unless the caller already attempted it — in that
 * case questions are omitted and the client should route to the results page.
 */

import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireSprintAccess } from '@/lib/sprint/route-helpers';
import { getActiveSet, getSetQuestionsForTaking, getUserAttempt } from '@/lib/sprint/service';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ setId: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireSprintAccess();
    const setId = Number((await params).setId);
    if (!Number.isInteger(setId)) throw new ApiException('Invalid set', 400);

    const set = await getActiveSet(setId);
    if (!set) throw new ApiException('Set not found', 404, 'SET_NOT_FOUND');

    const attempt = await getUserAttempt(setId, user.id);
    if (attempt) {
      return { set: { id: set.id, subject: set.subject, title: set.title }, alreadyAttempted: true };
    }

    const questions = await getSetQuestionsForTaking(setId);
    return {
      set: { id: set.id, subject: set.subject, title: set.title },
      alreadyAttempted: false,
      questions,
    };
  });
}

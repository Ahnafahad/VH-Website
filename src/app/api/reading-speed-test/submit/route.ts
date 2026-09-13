/**
 * POST /api/reading-speed-test/submit
 * Grades the attempt server-side (client only ever sent selections + timing)
 * and records it. Unlimited retakes — this is a self-check tool, not an exam.
 */

import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser } from '@/lib/reading-speed-test/route-helpers';
import { submitAttempt, verifyStartToken } from '@/lib/reading-speed-test/service';
import type { ReadingSpeedSubmitAnswer } from '@/lib/reading-speed-test/types';

export async function POST(req: Request) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const body = await req.json();

    const passageId = String(body?.passageId ?? '');
    if (!passageId) throw new ApiException('Invalid passage', 400);

    // Reading time is derived from the server-signed /start token, not client input —
    // the client's own clock can't be trusted for the leaderboard's ranking metric.
    const readingMs = verifyStartToken(String(body?.token ?? ''), user.id, passageId);

    const rawAnswers = body?.answers;
    if (!Array.isArray(rawAnswers)) throw new ApiException('Invalid answers', 400);
    const answers: ReadingSpeedSubmitAnswer[] = rawAnswers.map((a) => ({
      questionId: String(a?.questionId ?? ''),
      selectedIndex: Number.isInteger(a?.selectedIndex) ? Number(a.selectedIndex) : null,
    }));

    const visibilityInterruptions = Math.max(0, Number(body?.visibilityInterruptions) || 0);

    return submitAttempt(user.id, passageId, readingMs, answers, visibilityInterruptions);
  });
}

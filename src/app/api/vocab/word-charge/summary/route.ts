/**
 * GET /api/vocab/word-charge/summary
 *
 * Returns: ChargeSummaryResponse — personal best, rounds played, last played.
 */

import { db } from '@/lib/db';
import { users, vocabChargeRounds } from '@/lib/db/schema';
import { eq, and, max, count, desc } from 'drizzle-orm';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';

export async function GET() {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!user) throw new ApiException('User not found', 404);

    const finishedFilter = and(
      eq(vocabChargeRounds.userId, user.id),
      eq(vocabChargeRounds.status, 'finished'),
    );

    const [agg] = await db
      .select({
        personalBest:  max(vocabChargeRounds.pointsEarned),
        roundsPlayed:  count(vocabChargeRounds.id),
      })
      .from(vocabChargeRounds)
      .where(finishedFilter);

    const [lastRow] = await db
      .select({ finishedAt: vocabChargeRounds.finishedAt })
      .from(vocabChargeRounds)
      .where(finishedFilter)
      .orderBy(desc(vocabChargeRounds.finishedAt))
      .limit(1);

    return {
      personalBest:  agg?.personalBest  ?? 0,
      roundsPlayed:  agg?.roundsPlayed  ?? 0,
      lastPlayedAt:  lastRow?.finishedAt ? lastRow.finishedAt.toISOString() : null,
    };
  }, '/api/vocab/word-charge/summary');
}

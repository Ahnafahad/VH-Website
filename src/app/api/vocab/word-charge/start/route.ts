/**
 * POST /api/vocab/word-charge/start
 *
 * Creates a new Word Charge round for the authenticated user.
 * Returns: ChargeStartResponse
 */

import { db } from '@/lib/db';
import { users, vocabChargeRounds, vocabUserProgress } from '@/lib/db/schema';
import { eq, max } from 'drizzle-orm';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';
import { selectChargeWords } from '@/lib/vocab/word-charge/select';

export async function POST() {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!user) throw new ApiException('User not found', 404);

    const words = await selectChargeWords(user.id);
    if (words.length === 0) {
      throw new ApiException('No charged words available', 500);
    }

    const wordIds = words.map(w => w.id);

    // Create round row
    const [round] = await db
      .insert(vocabChargeRounds)
      .values({
        userId:  user.id,
        status:  'active',
        wordIds: JSON.stringify(wordIds),
      })
      .returning({ id: vocabChargeRounds.id });

    // Personal best = max pointsEarned over user's finished rounds
    const [pbRow] = await db
      .select({ best: max(vocabChargeRounds.pointsEarned) })
      .from(vocabChargeRounds)
      .where(eq(vocabChargeRounds.userId, user.id));
    const personalBest = pbRow?.best ?? 0;

    // Central point total
    const [progress] = await db
      .select({ totalPoints: vocabUserProgress.totalPoints })
      .from(vocabUserProgress)
      .where(eq(vocabUserProgress.userId, user.id))
      .limit(1);
    const totalPoints = progress?.totalPoints ?? 0;

    return {
      roundId:      round.id,
      words,
      personalBest,
      totalPoints,
    };
  }, '/api/vocab/word-charge/start');
}

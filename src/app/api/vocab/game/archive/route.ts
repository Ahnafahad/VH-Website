/**
 * GET /api/vocab/game/archive
 *
 * Lists every round up to and including today (Dhaka calendar day), with the
 * user's play status for each. No hidden-word data is leaked for unplayed
 * rounds — this endpoint only reads vocab_game_rounds.round_date/id and the
 * user's own session rows.
 *
 * Returns: { date, played, status?, totalEarned?, isToday }[]
 */

import { eq, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, vocabGameRounds, vocabGameSessions } from '@/lib/db/schema';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';
import { todayDhaka } from '@/lib/vocab/game/dates';

export async function GET() {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();

    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (!user) throw new ApiException('User not found', 404);

    const today = todayDhaka();

    const rounds = await db
      .select({ id: vocabGameRounds.id, roundDate: vocabGameRounds.roundDate })
      .from(vocabGameRounds)
      .where(lte(vocabGameRounds.roundDate, today))
      .orderBy(vocabGameRounds.roundDate);

    const sessions = await db
      .select({
        roundId:        vocabGameSessions.roundId,
        status:         vocabGameSessions.status,
        wordPoints:     vocabGameSessions.wordPoints,
        sentencePoints: vocabGameSessions.sentencePoints,
      })
      .from(vocabGameSessions)
      .where(eq(vocabGameSessions.userId, user.id));

    const sessionByRound = new Map(sessions.map(s => [s.roundId, s]));

    return rounds.map(r => {
      const session = sessionByRound.get(r.id);
      const isToday = r.roundDate === today;
      return {
        date:    r.roundDate,
        played:  session?.status === 'won' || session?.status === 'lost',
        ...(session ? { status: session.status, totalEarned: session.wordPoints + session.sentencePoints } : {}),
        isToday,
      };
    });
  }, '/api/vocab/game/archive');
}

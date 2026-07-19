/**
 * GET /api/vocab/game/state?date=YYYY-MM-DD
 *
 * Public round info for a given Dhaka calendar day (default: today). Never
 * leaks the hidden word, its answer list, or locked clue tiers.
 *
 * Returns: GameStateResponse (see src/lib/vocab/game/types.ts)
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, vocabGameRounds } from '@/lib/db/schema';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';
import { todayDhaka, isFutureDate, isPastDate } from '@/lib/vocab/game/dates';
import { buildGameStateResponse } from '@/lib/vocab/game/state-builder';
import type { RoundContent } from '@/lib/vocab/game/types';

export async function GET(req: NextRequest) {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();

    const date = req.nextUrl.searchParams.get('date') ?? todayDhaka();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new ApiException('date must be YYYY-MM-DD', 400);
    }
    if (isFutureDate(date)) throw new ApiException('Round not available yet', 403);

    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (!user) throw new ApiException('User not found', 404);

    const [round] = await db
      .select()
      .from(vocabGameRounds)
      .where(eq(vocabGameRounds.roundDate, date))
      .limit(1);
    if (!round) throw new ApiException('No round for this date', 404);

    const content = JSON.parse(round.content) as RoundContent;
    const isCatchUp = isPastDate(date);

    return buildGameStateResponse(user.id, round, content, date, isCatchUp);
  }, '/api/vocab/game/state');
}

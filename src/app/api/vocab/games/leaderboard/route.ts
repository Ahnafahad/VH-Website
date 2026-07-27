/**
 * GET /api/vocab/games/leaderboard?game=word-hunt|word-charge
 *
 * Mini leaderboard for a single LexiCore game: top 5 by best single run,
 * top 5 by cumulative points, plus the caller's own row when outside top 5.
 * Suspended users are excluded.
 */

import { NextRequest } from 'next/server';
import { eq, and, ne, inArray, sql } from 'drizzle-orm';
import { db, users, vocabChargeRounds, vocabGameSessions } from '@/lib/db';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';
import type { MiniEntry, MiniLeaderboardResponse } from '@/lib/vocab/mini-leaderboard';

type Row = { userId: number; name: string | null; best: number; total: number };

function buildResponse(rows: Row[], meId: number): MiniLeaderboardResponse {
  const toEntries = (sorted: Row[], scoreOf: (r: Row) => number): MiniEntry[] =>
    sorted.map((r, i) => ({
      rank:        i + 1,
      userId:      r.userId,
      displayName: r.name ?? 'Anonymous',
      points:      scoreOf(r),
      isMe:        r.userId === meId,
    }));

  const byBest = [...rows].sort((a, b) => b.best - a.best || b.total - a.total || a.userId - b.userId);
  const byTotal = [...rows].sort((a, b) => b.total - a.total || b.best - a.best || a.userId - b.userId);

  const topAll = toEntries(byBest, r => r.best);
  const lifetimeAll = toEntries(byTotal, r => r.total);

  const top = topAll.slice(0, 5);
  const lifetime = lifetimeAll.slice(0, 5);

  const myTop = top.some(e => e.isMe) ? null : (topAll.find(e => e.isMe) ?? null);
  const myLifetime = lifetime.some(e => e.isMe) ? null : (lifetimeAll.find(e => e.isMe) ?? null);

  return { top, lifetime, myTop, myLifetime };
}

export async function GET(req: NextRequest) {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();
    const game = req.nextUrl.searchParams.get('game');

    if (game !== 'word-hunt' && game !== 'word-charge') {
      throw new ApiException('Invalid game', 400);
    }

    const [me] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!me) throw new ApiException('User not found', 404);

    let rows: Row[];

    if (game === 'word-charge') {
      rows = await db
        .select({
          userId: vocabChargeRounds.userId,
          name:   users.name,
          best:   sql<number>`max(${vocabChargeRounds.pointsEarned})`,
          total:  sql<number>`sum(${vocabChargeRounds.pointsEarned})`,
        })
        .from(vocabChargeRounds)
        .innerJoin(users, eq(vocabChargeRounds.userId, users.id))
        .where(and(eq(vocabChargeRounds.status, 'finished'), ne(users.status, 'inactive')))
        .groupBy(vocabChargeRounds.userId, users.name);
    } else {
      rows = await db
        .select({
          userId: vocabGameSessions.userId,
          name:   users.name,
          best:   sql<number>`max(${vocabGameSessions.wordPoints} + ${vocabGameSessions.sentencePoints})`,
          total:  sql<number>`sum(${vocabGameSessions.wordPoints} + ${vocabGameSessions.sentencePoints})`,
        })
        .from(vocabGameSessions)
        .innerJoin(users, eq(vocabGameSessions.userId, users.id))
        .where(and(inArray(vocabGameSessions.status, ['won', 'lost']), ne(users.status, 'inactive')))
        .groupBy(vocabGameSessions.userId, users.name);
    }

    return buildResponse(rows, me.id);
  }, '/api/vocab/games/leaderboard');
}

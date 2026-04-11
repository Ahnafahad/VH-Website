import { db, users, vocabUserProgress, vocabHallOfFame } from '@/lib/db';
import { eq, desc, ne, gt, sql, count } from 'drizzle-orm';

export interface LeaderEntry {
  rank:         number;
  userId:       number;
  displayName:  string;
  weeklyPoints: number;
  isMe:         boolean;
}

export interface AllTimeEntry {
  rank:        number;
  userId:      number;
  displayName: string;
  totalPoints: number;
  isMe:        boolean;
}

export interface HallEntry {
  rank:         number;
  displayName:  string;
  points:       number;
  sessionLabel: string;
}

export interface LeaderboardData {
  weekly:          LeaderEntry[];
  allTime:         AllTimeEntry[];
  hall:            HallEntry[];
  myWeeklyRank:    number | null;
  myWeeklyPoints:  number;
  myAllTimeRank:   number | null;
  myAllTimePoints: number;
}

export async function getLeaderboardData(email: string): Promise<LeaderboardData | null> {
  const [me] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!me) return null;

  // ── Weekly ──────────────────────────────────────────────────────────────────
  const weeklyTop = await db
    .select({
      userId:       vocabUserProgress.userId,
      weeklyPoints: vocabUserProgress.weeklyPoints,
      displayName:  users.name,
    })
    .from(vocabUserProgress)
    .innerJoin(users, eq(vocabUserProgress.userId, users.id))
    .where(ne(users.status, 'inactive'))
    .orderBy(desc(vocabUserProgress.weeklyPoints))
    .limit(20);

  const weekly: LeaderEntry[] = weeklyTop.map((t, i) => ({
    rank:         i + 1,
    userId:       t.userId,
    displayName:  t.displayName ?? 'Anonymous',
    weeklyPoints: t.weeklyPoints ?? 0,
    isMe:         t.userId === me.id,
  }));

  let myWeeklyRank    = weekly.find(e => e.isMe)?.rank ?? null;
  let myWeeklyPoints  = weekly.find(e => e.isMe)?.weeklyPoints ?? 0;

  if (myWeeklyRank === null) {
    const [myProg] = await db
      .select({ weeklyPoints: vocabUserProgress.weeklyPoints })
      .from(vocabUserProgress)
      .where(eq(vocabUserProgress.userId, me.id))
      .limit(1);
    myWeeklyPoints = myProg?.weeklyPoints ?? 0;

    // Use COUNT instead of loading all rows
    const [{ rankCount }] = await db
      .select({ rankCount: count() })
      .from(vocabUserProgress)
      .innerJoin(users, eq(vocabUserProgress.userId, users.id))
      .where(gt(vocabUserProgress.weeklyPoints, myWeeklyPoints));
    myWeeklyRank = rankCount + 1;

    weekly.push({
      rank: myWeeklyRank, userId: me.id,
      displayName: me.name ?? 'Anonymous',
      weeklyPoints: myWeeklyPoints, isMe: true,
    });
  }

  // ── All-time ─────────────────────────────────────────────────────────────────
  const allTimeTop = await db
    .select({
      userId:      vocabUserProgress.userId,
      totalPoints: vocabUserProgress.totalPoints,
      displayName: users.name,
    })
    .from(vocabUserProgress)
    .innerJoin(users, eq(vocabUserProgress.userId, users.id))
    .where(ne(users.status, 'inactive'))
    .orderBy(desc(vocabUserProgress.totalPoints))
    .limit(20);

  const allTime: AllTimeEntry[] = allTimeTop.map((t, i) => ({
    rank:        i + 1,
    userId:      t.userId,
    displayName: t.displayName ?? 'Anonymous',
    totalPoints: t.totalPoints ?? 0,
    isMe:        t.userId === me.id,
  }));

  let myAllTimeRank   = allTime.find(e => e.isMe)?.rank ?? null;
  let myAllTimePoints = allTime.find(e => e.isMe)?.totalPoints ?? 0;

  if (myAllTimeRank === null) {
    const [myProg] = await db
      .select({ totalPoints: vocabUserProgress.totalPoints })
      .from(vocabUserProgress)
      .where(eq(vocabUserProgress.userId, me.id))
      .limit(1);
    myAllTimePoints = myProg?.totalPoints ?? 0;

    // Use COUNT instead of loading all rows
    const [{ rankCount }] = await db
      .select({ rankCount: count() })
      .from(vocabUserProgress)
      .innerJoin(users, eq(vocabUserProgress.userId, users.id))
      .where(gt(vocabUserProgress.totalPoints, myAllTimePoints));
    myAllTimeRank = rankCount + 1;

    allTime.push({
      rank: myAllTimeRank, userId: me.id,
      displayName: me.name ?? 'Anonymous',
      totalPoints: myAllTimePoints, isMe: true,
    });
  }

  // ── Hall of Fame ─────────────────────────────────────────────────────────────
  const hallRaw = await db
    .select()
    .from(vocabHallOfFame)
    .orderBy(desc(vocabHallOfFame.weekEndDate), vocabHallOfFame.rank)
    .limit(12);

  const hall: HallEntry[] = hallRaw.map(h => ({
    rank:         h.rank,
    displayName:  h.displayName ?? 'Anonymous',
    points:       h.points ?? 0,
    sessionLabel: h.sessionLabel,
  }));

  return { weekly, allTime, hall, myWeeklyRank, myWeeklyPoints, myAllTimeRank, myAllTimePoints };
}

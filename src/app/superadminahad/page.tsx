import { getServerSession }       from 'next-auth';
import { redirect }               from 'next/navigation';
import { eq, sql, count }         from 'drizzle-orm';
import { authOptions }            from '@/lib/auth';
import {
  db,
  users,
  userAccess,
  vocabUserProgress,
  vocabUserWordRecords,
  vocabQuizSessions,
  vocabUserBadges,
  vocabUpgradeRequests,
  vocabWords,
} from '@/lib/db';
import { BADGE_DEFS }             from '@/lib/vocab/badges/definitions';
import AdminLexiStats             from './AdminLexiStats';

// ─── Type definitions ─────────────────────────────────────────────────────────

export interface UserMastery {
  new:      number;
  learning: number;
  familiar: number;
  strong:   number;
  mastered: number;
  total:    number;
}

export interface UserQuizStats {
  totalSessions:     number;
  completedSessions: number;
  totalCorrect:      number;
  totalQuestions:    number;
  passRate:          number; // 0–100
}

export interface UserAdminRow {
  // Identity
  id:          number;
  name:        string;
  email:       string;
  role:        string;
  joinedAt:    string; // ISO
  // Vocab progress
  hasVocab:          boolean;
  phase:             number;
  totalPoints:       number;
  weeklyPoints:      number;
  streakDays:        number;
  longestStreak:     number;
  dailyTarget:       number;
  deadline:          string | null;
  lastStudyDate:     string | null;
  onboardingDone:    boolean;
  // Word mastery
  mastery:           UserMastery;
  // Quiz stats
  quiz:              UserQuizStats;
  // Badges
  badgesEarned:      number;
  badgesTotal:       number;
  // Access
  products:          string[];
  // WTP
  wtpChoice:         string | null;
  wtpAt:             string | null;
}

export interface AdminGlobalStats {
  totalUsers:       number;
  vocabUsers:       number;
  activeToday:      number;
  activeThisWeek:   number;
  usersWithStreak:  number;
  paidUsers:        number;
  totalBadgeDefs:   number;
  totalWords:       number;
  wtpResponses:     number;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SuperAdminPage() {
  const session = await getServerSession(authOptions);

  // Strict email guard
  if (!session?.user?.email || session.user.email !== 'ahnaf816@gmail.com') {
    redirect('/');
  }

  // ── Fetch everything in parallel ──────────────────────────────────────────

  const [
    allUsers,
    allProgress,
    masteryAgg,
    quizAgg,
    badgeAgg,
    accessRows,
    upgradeRows,
    [{ totalWords }],
  ] = await Promise.all([
    // All users
    db.select().from(users).orderBy(users.createdAt),

    // All vocab progress
    db.select().from(vocabUserProgress),

    // Mastery breakdown per user (GROUP BY userId, masteryLevel)
    db
      .select({
        userId:       vocabUserWordRecords.userId,
        masteryLevel: vocabUserWordRecords.masteryLevel,
        cnt:          count(),
      })
      .from(vocabUserWordRecords)
      .groupBy(vocabUserWordRecords.userId, vocabUserWordRecords.masteryLevel),

    // Quiz stats per user
    db
      .select({
        userId:           vocabQuizSessions.userId,
        totalSessions:    count(),
        completedCount:   sql<number>`count(case when ${vocabQuizSessions.status} = 'complete' then 1 end)`,
        totalCorrect:     sql<number>`coalesce(sum(${vocabQuizSessions.correctAnswers}), 0)`,
        totalQuestions:   sql<number>`coalesce(sum(${vocabQuizSessions.totalQuestions}), 0)`,
      })
      .from(vocabQuizSessions)
      .groupBy(vocabQuizSessions.userId),

    // Badge counts per user
    db
      .select({
        userId:      vocabUserBadges.userId,
        earnedCount: sql<number>`count(case when ${vocabUserBadges.earnedAt} is not null then 1 end)`,
      })
      .from(vocabUserBadges)
      .groupBy(vocabUserBadges.userId),

    // Active user access rows
    db.select().from(userAccess).where(eq(userAccess.active, true)),

    // Upgrade/WTP requests
    db.select().from(vocabUpgradeRequests),

    // Total words
    db.select({ totalWords: count() }).from(vocabWords),
  ]);

  // ── Build lookup maps ──────────────────────────────────────────────────────

  const progressMap = new Map(allProgress.map(p => [p.userId, p]));

  // masteryAgg → Map<userId, { new: N, learning: N, ... }>
  const masteryMap = new Map<number, UserMastery>();
  for (const row of masteryAgg) {
    if (!masteryMap.has(row.userId)) {
      masteryMap.set(row.userId, { new: 0, learning: 0, familiar: 0, strong: 0, mastered: 0, total: 0 });
    }
    const m = masteryMap.get(row.userId)!;
    const lvl = row.masteryLevel as keyof UserMastery;
    if (lvl !== 'total') m[lvl] = Number(row.cnt);
    m.total += Number(row.cnt);
  }

  const quizMap = new Map(quizAgg.map(r => [r.userId, r]));

  const badgeMap = new Map(badgeAgg.map(r => [r.userId, Number(r.earnedCount)]));

  // Access: Map<userId, product[]>
  const accessMap = new Map<number, string[]>();
  for (const row of accessRows) {
    const list = accessMap.get(row.userId) ?? [];
    list.push(row.product);
    accessMap.set(row.userId, list);
  }

  // WTP: Map<userId, { option, at }>
  const wtpMap = new Map(upgradeRows.map(r => [r.userId, r]));

  const totalBadgeDefs = BADGE_DEFS.length;

  // ── Assemble per-user rows ─────────────────────────────────────────────────

  const now = Date.now();
  const ONE_DAY  = 86_400_000;
  const ONE_WEEK = 7 * ONE_DAY;

  const userRows: UserAdminRow[] = allUsers.map(u => {
    const p    = progressMap.get(u.id);
    const m    = masteryMap.get(u.id) ?? { new: 0, learning: 0, familiar: 0, strong: 0, mastered: 0, total: 0 };
    const q    = quizMap.get(u.id);
    const wtp  = wtpMap.get(u.id);
    const prods = accessMap.get(u.id) ?? [];

    const completedSessions = Number(q?.completedCount ?? 0);
    const totalQs           = Number(q?.totalQuestions ?? 0);
    const totalCorrect      = Number(q?.totalCorrect   ?? 0);
    const passRate          = totalQs > 0 ? Math.round((totalCorrect / totalQs) * 100) : 0;

    return {
      id:          u.id,
      name:        u.name,
      email:       u.email,
      role:        u.role,
      joinedAt:    new Date(u.createdAt).toISOString(),
      hasVocab:          !!p,
      phase:             p?.phase             ?? 2,
      totalPoints:       p?.totalPoints       ?? 0,
      weeklyPoints:      p?.weeklyPoints      ?? 0,
      streakDays:        p?.streakDays        ?? 0,
      longestStreak:     p?.longestStreak     ?? 0,
      dailyTarget:       p?.dailyTarget       ?? 10,
      deadline:          p?.deadline          ? new Date(p.deadline).toISOString() : null,
      lastStudyDate:     p?.lastStudyDate     ? new Date(p.lastStudyDate).toISOString() : null,
      onboardingDone:    p?.onboardingComplete ?? false,
      mastery:           m,
      quiz: {
        totalSessions:     Number(q?.totalSessions ?? 0),
        completedSessions,
        totalCorrect,
        totalQuestions:    totalQs,
        passRate,
      },
      badgesEarned:  badgeMap.get(u.id) ?? 0,
      badgesTotal:   totalBadgeDefs,
      products:      prods,
      wtpChoice:     wtp?.selectedOption ?? null,
      wtpAt:         wtp?.submittedAt ? new Date(wtp.submittedAt).toISOString() : null,
    };
  });

  // ── Global stats ───────────────────────────────────────────────────────────

  const vocabUsers    = allProgress.length;
  const paidUserIds   = new Set(accessRows.map(r => r.userId));
  const paidUsers     = paidUserIds.size;

  let activeToday = 0, activeThisWeek = 0, usersWithStreak = 0;
  for (const p of allProgress) {
    if (p.lastStudyDate) {
      const ts = new Date(p.lastStudyDate).getTime();
      if (now - ts < ONE_DAY)  activeToday++;
      if (now - ts < ONE_WEEK) activeThisWeek++;
    }
    if (p.streakDays > 0) usersWithStreak++;
  }

  const globalStats: AdminGlobalStats = {
    totalUsers:      allUsers.length,
    vocabUsers,
    activeToday,
    activeThisWeek,
    usersWithStreak,
    paidUsers,
    totalBadgeDefs,
    totalWords:      Number(totalWords),
    wtpResponses:    upgradeRows.length,
  };

  return <AdminLexiStats rows={userRows} globalStats={globalStats} />;
}

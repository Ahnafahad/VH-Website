import {
  db, users, vocabUserProgress, vocabUserWordRecords,
  vocabWords, vocabUserBadges, vocabAdminSettings,
} from '@/lib/db';
import { eq, and, count, isNotNull, desc } from 'drizzle-orm';
import { BADGE_MAP } from '@/lib/vocab/badges/definitions';

export interface PublicProfileBadge {
  id:          string;
  name:        string;
  description: string;
  category:    'short_term' | 'mid_term' | 'long_term' | 'ultimate';
  earnedAt:    string; // ISO
}

export interface PublicProfile {
  userId:        number;
  name:          string;
  memberSince:   string;  // ISO date
  totalPoints:   number;
  weeklyPoints:  number;
  streakDays:    number;
  longestStreak: number;
  wordsMastered: number;
  totalWords:    number;
  badgesEarned:  number;              // count of earned badges (== badges.length)
  badges:        PublicProfileBadge[]; // EARNED ONLY, sorted by earnedAt desc
}

export async function getPublicProfile(userId: number): Promise<PublicProfile | null> {
  const [user] = await db
    .select({ id: users.id, name: users.name, status: users.status })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || user.status === 'inactive') return null;

  const [progress] = await db
    .select({
      totalPoints:   vocabUserProgress.totalPoints,
      weeklyPoints:  vocabUserProgress.weeklyPoints,
      streakDays:    vocabUserProgress.streakDays,
      longestStreak: vocabUserProgress.longestStreak,
      createdAt:     vocabUserProgress.createdAt,
    })
    .from(vocabUserProgress)
    .where(eq(vocabUserProgress.userId, userId))
    .limit(1);
  if (!progress) return null;

  const [{ wordsMastered }] = await db
    .select({ wordsMastered: count() })
    .from(vocabUserWordRecords)
    .where(and(
      eq(vocabUserWordRecords.userId, userId),
      eq(vocabUserWordRecords.masteryLevel, 'mastered'),
    ));

  const [{ totalWords }] = await db
    .select({ totalWords: count() })
    .from(vocabWords);

  const [ultimateSetting] = await db
    .select({ value: vocabAdminSettings.value })
    .from(vocabAdminSettings)
    .where(eq(vocabAdminSettings.key, 'ultimate_achievements_visible'))
    .limit(1);
  const ultimateVisible = ultimateSetting?.value === 'true';

  const earnedRows = await db
    .select({
      badgeId:  vocabUserBadges.badgeId,
      earnedAt: vocabUserBadges.earnedAt,
    })
    .from(vocabUserBadges)
    .where(and(
      eq(vocabUserBadges.userId, userId),
      isNotNull(vocabUserBadges.earnedAt),
    ))
    .orderBy(desc(vocabUserBadges.earnedAt));

  const badges: PublicProfileBadge[] = earnedRows
    .map(row => {
      const def = BADGE_MAP.get(row.badgeId);
      if (!def) return null;
      if (def.category === 'ultimate' && !ultimateVisible) return null;
      return {
        id:          def.id,
        name:        def.name,
        description: def.description,
        category:    def.category,
        earnedAt:    new Date(row.earnedAt!).toISOString(),
      };
    })
    .filter((b): b is PublicProfileBadge => b !== null);

  return {
    userId,
    name:          user.name ?? 'Anonymous',
    memberSince:   new Date(progress.createdAt).toISOString(),
    totalPoints:   progress.totalPoints   ?? 0,
    weeklyPoints:  progress.weeklyPoints  ?? 0,
    streakDays:    progress.streakDays    ?? 0,
    longestStreak: progress.longestStreak ?? 0,
    wordsMastered: Number(wordsMastered ?? 0),
    totalWords:    Number(totalWords ?? 0),
    badgesEarned:  badges.length,
    badges,
  };
}

import { getServerSession }  from 'next-auth';
import { redirect }          from 'next/navigation';
import { eq, sql, count }    from 'drizzle-orm';
import { authOptions }       from '@/lib/auth';
import {
  db, users, vocabUserProgress, vocabUserWordRecords,
  vocabWords, vocabUserBadges, vocabAdminSettings,
} from '@/lib/db';
import { BADGE_DEFS }        from '@/lib/vocab/badges/definitions';
import ProfileScreen         from './ProfileScreen';

// ─── Exported types (consumed by ProfileScreen) ───────────────────────────────

export interface LevelStats {
  new:      number;
  learning: number;
  familiar: number;
  strong:   number;
  mastered: number;
  total:    number;
}

export interface BadgeRow {
  id:          string;
  name:        string;
  description: string;
  category:    'short_term' | 'mid_term' | 'long_term' | 'ultimate';
  earned:      boolean;
  earnedAt:    string | null;
  progress:    number;
}

export interface WordRow {
  id:           number;
  word:         string;
  partOfSpeech: string;
  masteryLevel: string;
  masteryScore: number;
}

export interface ProfileData {
  name:                 string;
  email:                string;
  image:                string | null;
  phase:                number;
  totalPoints:          number;
  weeklyPoints:         number;
  streakDays:           number;
  longestStreak:        number;
  memberSince:          string;         // ISO date
  levelStats:           LevelStats;
  badges:               BadgeRow[];
  words:                WordRow[];
  ultimateVisible:      boolean;
  // Settings fields
  deadline:             string | null;  // ISO date string or null
  dailyTarget:          number;
  notificationsEnabled: boolean;
  emailSummaryEnabled:  boolean;
}

// ─── Page (Server Component) ──────────────────────────────────────────────────

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin?callbackUrl=/vocab/profile');

  const { tab } = await searchParams;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);
  if (!user) redirect('/vocab/onboarding');

  const [progress] = await db
    .select()
    .from(vocabUserProgress)
    .where(eq(vocabUserProgress.userId, user.id))
    .limit(1);
  if (!progress) redirect('/vocab/onboarding');

  // ── Level stats ─────────────────────────────────────────────────────────────
  const [rawLevel] = await db
    .select({
      newCount:      sql<number>`count(case when ${vocabUserWordRecords.masteryLevel} = 'new' then 1 end)`,
      learningCount: sql<number>`count(case when ${vocabUserWordRecords.masteryLevel} = 'learning' then 1 end)`,
      familiarCount: sql<number>`count(case when ${vocabUserWordRecords.masteryLevel} = 'familiar' then 1 end)`,
      strongCount:   sql<number>`count(case when ${vocabUserWordRecords.masteryLevel} = 'strong' then 1 end)`,
      masteredCount: sql<number>`count(case when ${vocabUserWordRecords.masteryLevel} = 'mastered' then 1 end)`,
    })
    .from(vocabUserWordRecords)
    .where(eq(vocabUserWordRecords.userId, user.id));

  const [{ totalWords }] = await db
    .select({ totalWords: count() })
    .from(vocabWords);

  const levelStats: LevelStats = {
    new:      Number(rawLevel?.newCount      ?? 0),
    learning: Number(rawLevel?.learningCount ?? 0),
    familiar: Number(rawLevel?.familiarCount ?? 0),
    strong:   Number(rawLevel?.strongCount   ?? 0),
    mastered: Number(rawLevel?.masteredCount ?? 0),
    total:    Number(totalWords ?? 0),
  };

  // ── Badges ───────────────────────────────────────────────────────────────────
  const [ultimateSetting] = await db
    .select({ value: vocabAdminSettings.value })
    .from(vocabAdminSettings)
    .where(eq(vocabAdminSettings.key, 'ultimate_achievements_visible'))
    .limit(1);
  const ultimateVisible = ultimateSetting?.value === 'true';

  const userBadgeRows = await db
    .select({
      badgeId:  vocabUserBadges.badgeId,
      earnedAt: vocabUserBadges.earnedAt,
      progress: vocabUserBadges.progress,
    })
    .from(vocabUserBadges)
    .where(eq(vocabUserBadges.userId, user.id));

  const userBadgeMap = new Map(userBadgeRows.map(r => [r.badgeId, r]));

  const badges: BadgeRow[] = BADGE_DEFS
    .filter(def => def.category !== 'ultimate' || ultimateVisible)
    .map(def => {
      const row = userBadgeMap.get(def.id);
      return {
        id:          def.id,
        name:        def.name,
        description: def.description,
        category:    def.category,
        earned:      !!row?.earnedAt,
        earnedAt:    row?.earnedAt ? new Date(row.earnedAt).toISOString() : null,
        progress:    row?.progress ?? 0,
      };
    });

  // ── Word list ────────────────────────────────────────────────────────────────
  const allWords = await db
    .select({
      id:           vocabWords.id,
      word:         vocabWords.word,
      partOfSpeech: vocabWords.partOfSpeech,
    })
    .from(vocabWords)
    .orderBy(vocabWords.word);

  const userRecords = await db
    .select({
      wordId:       vocabUserWordRecords.wordId,
      masteryLevel: vocabUserWordRecords.masteryLevel,
      masteryScore: vocabUserWordRecords.masteryScore,
    })
    .from(vocabUserWordRecords)
    .where(eq(vocabUserWordRecords.userId, user.id));

  const recordMap = new Map(userRecords.map(r => [r.wordId, r]));

  const words: WordRow[] = allWords.map(w => {
    const rec = recordMap.get(w.id);
    return {
      id:           w.id,
      word:         w.word,
      partOfSpeech: w.partOfSpeech,
      masteryLevel: rec?.masteryLevel ?? 'new',
      masteryScore: rec ? Number(rec.masteryScore ?? 0) : 0,
    };
  });

  // ── Assemble ─────────────────────────────────────────────────────────────────
  const data: ProfileData = {
    name:                 user.name          ?? 'Learner',
    email:                user.email         ?? '',
    image:                session.user?.image ?? null,
    phase:                progress.phase         ?? 2,
    totalPoints:          progress.totalPoints   ?? 0,
    weeklyPoints:         progress.weeklyPoints  ?? 0,
    streakDays:           progress.streakDays    ?? 0,
    longestStreak:        progress.longestStreak ?? 0,
    memberSince:          new Date(progress.createdAt).toISOString(),
    levelStats,
    badges,
    words,
    ultimateVisible,
    // Settings
    deadline:             progress.deadline
                            ? new Date(progress.deadline).toISOString()
                            : null,
    dailyTarget:          progress.dailyTarget          ?? 10,
    notificationsEnabled: progress.notificationsEnabled ?? false,
    emailSummaryEnabled:  progress.emailSummaryEnabled  ?? true,
  };

  return <ProfileScreen data={data} initialTab={tab === 'settings' ? 'settings' : 'profile'} />;
}

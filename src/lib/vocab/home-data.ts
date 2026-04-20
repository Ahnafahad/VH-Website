import {
  db, users, userAccess, vocabUserProgress, vocabUserWordRecords,
  vocabFlashcardSessions, vocabThemes, vocabQuizSessions, vocabWords,
} from '@/lib/db';
import { eq, and, lte, count, sql, inArray } from 'drizzle-orm';
import { FREE_WORD_POOL, PAID_WORD_POOL } from './constants';
import { unstable_cache } from 'next/cache';
import { VocabCacheTag } from './cache-keys';

export interface MasteryBreakdown {
  new:      number;
  learning: number;
  familiar: number;
  strong:   number;
  mastered: number;
}

export interface SessionsData {
  review:   { count: number } | null;
  quiz:     { themeId: number; name: string; wordCount: number } | null;
  learn:    { themeId: number; name: string; wordCount: number; progress: number } | null;
  practice: { count: number } | null;
}

export interface HomeData {
  userName:         string;
  streakDays:       number;
  totalPoints:      number;
  weeklyPoints:     number;
  dueWordsCount:    number;
  dailyTarget:      number;
  goalProgress:     number;        // 0–100 percentage of today's target reviewed
  deadline:         string | null;
  lastStudyUnit:    string | null; // e.g. "Unit 3 · Theme 2"
  phase:            number;
  sessions:         SessionsData;
  masteryBreakdown: MasteryBreakdown;
  hasPaidAccess:    boolean;       // true if user has any active product or is admin
}

async function _getHomeData(email: string): Promise<HomeData | null> {
  const [user] = await db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) return null;

  const [progress] = await db
    .select()
    .from(vocabUserProgress)
    .where(eq(vocabUserProgress.userId, user.id))
    .limit(1);

  if (!progress) return null;

  const now = new Date();

  // ── Parallel queries ──────────────────────────────────────────────────────

  const [
    dueResult,
    reviewedToday,
    lastSession,
    masteryRows,
    weakResult,
    flashcardSessions,
    completedQuizzes,
    allThemes,
    accessRows,
  ] = await Promise.all([
    // SRS due count
    db.select({ value: count() })
      .from(vocabUserWordRecords)
      .where(and(
        eq(vocabUserWordRecords.userId, user.id),
        eq(vocabUserWordRecords.inSrsPool, true),
        lte(vocabUserWordRecords.srsNextReviewDate, now),
      )),

    // Words reviewed today
    db.select({ value: count() })
      .from(vocabUserWordRecords)
      .where(and(
        eq(vocabUserWordRecords.userId, user.id),
        sql`${vocabUserWordRecords.lastInteractionAt} >= ${Math.floor(new Date().setHours(0, 0, 0, 0) / 1000)}`,
      )),

    // Last active flashcard session
    db.select({
      themeId:   vocabFlashcardSessions.themeId,
      themeName: vocabThemes.name,
    })
      .from(vocabFlashcardSessions)
      .innerJoin(vocabThemes, eq(vocabFlashcardSessions.themeId, vocabThemes.id))
      .where(and(
        eq(vocabFlashcardSessions.userId, user.id),
        eq(vocabFlashcardSessions.status, 'in_progress'),
      ))
      .orderBy(sql`${vocabFlashcardSessions.startedAt} DESC`)
      .limit(1),

    // Mastery breakdown
    db.select({
      level: vocabUserWordRecords.masteryLevel,
      cnt:   count(),
    })
      .from(vocabUserWordRecords)
      .where(eq(vocabUserWordRecords.userId, user.id))
      .groupBy(vocabUserWordRecords.masteryLevel),

    // Weak words count (new or learning)
    db.select({ value: count() })
      .from(vocabUserWordRecords)
      .where(and(
        eq(vocabUserWordRecords.userId, user.id),
        inArray(vocabUserWordRecords.masteryLevel, ['new', 'learning']),
      )),

    // All flashcard sessions for this user
    db.select({ themeId: vocabFlashcardSessions.themeId, status: vocabFlashcardSessions.status })
      .from(vocabFlashcardSessions)
      .where(eq(vocabFlashcardSessions.userId, user.id)),

    // Completed study quiz sessions
    db.select({ themeId: vocabQuizSessions.themeId })
      .from(vocabQuizSessions)
      .where(and(
        eq(vocabQuizSessions.userId, user.id),
        eq(vocabQuizSessions.status, 'complete'),
        eq(vocabQuizSessions.sessionType, 'study'),
      )),

    // All themes with word counts
    db.select({
      id:        vocabThemes.id,
      name:      vocabThemes.name,
      unitId:    vocabThemes.unitId,
      wordCount: sql<number>`count(${vocabWords.id})`.as('wc'),
    })
      .from(vocabThemes)
      .leftJoin(vocabWords, eq(vocabWords.themeId, vocabThemes.id))
      .groupBy(vocabThemes.id)
      .orderBy(vocabThemes.order),

    // User paid access
    db.select({ id: userAccess.id })
      .from(userAccess)
      .where(and(eq(userAccess.userId, user.id), eq(userAccess.active, true)))
      .limit(1),
  ]);

  // ── Compute basics ────────────────────────────────────────────────────────

  const reviewedCount = reviewedToday[0]?.value ?? 0;
  const dueWordsCount = dueResult[0]?.value ?? 0;

  // ── Mastery breakdown ─────────────────────────────────────────────────────

  const breakdown: MasteryBreakdown = { new: 0, learning: 0, familiar: 0, strong: 0, mastered: 0 };
  for (const row of masteryRows) {
    const lvl = row.level as keyof MasteryBreakdown;
    if (lvl in breakdown) breakdown[lvl] = row.cnt;
  }

  // ── Sessions logic ────────────────────────────────────────────────────────

  const flashcardMap = new Map(flashcardSessions.map(s => [s.themeId, s.status]));
  const quizDoneSet  = new Set(completedQuizzes.map(q => q.themeId).filter((id): id is number => id !== null));

  // review session
  const reviewSession: SessionsData['review'] = dueWordsCount > 0 ? { count: dueWordsCount } : null;

  // quiz-ready theme: flashcard complete, no completed study quiz yet
  const quizReadyTheme = allThemes.find(t => {
    const fs = flashcardMap.get(t.id);
    return fs === 'complete' && !quizDoneSet.has(t.id);
  }) ?? null;
  const quizSession: SessionsData['quiz'] = quizReadyTheme
    ? { themeId: quizReadyTheme.id, name: quizReadyTheme.name, wordCount: quizReadyTheme.wordCount }
    : null;

  // learn theme: in-progress flashcard (not complete), or first not-started theme
  const inProgressTheme = allThemes.find(t => flashcardMap.get(t.id) === 'in_progress') ?? null;
  const notStartedTheme = allThemes.find(t => !flashcardMap.has(t.id)) ?? null;
  const learnCandidate  = inProgressTheme ?? notStartedTheme;
  const learnSession: SessionsData['learn'] = learnCandidate ? {
    themeId:   learnCandidate.id,
    name:      learnCandidate.name,
    wordCount: learnCandidate.wordCount,
    progress:  0, // simplification — could compute later
  } : null;

  // practice session
  const weakCount = weakResult[0]?.value ?? 0;
  const practiceSession: SessionsData['practice'] = weakCount > 0 ? { count: weakCount } : null;

  const sessions: SessionsData = {
    review:   reviewSession,
    quiz:     quizSession,
    learn:    learnSession,
    practice: practiceSession,
  };

  const isAdmin     = user.role === 'admin' || user.role === 'super_admin';
  const hasPaidAccess = isAdmin || accessRows.length > 0;

  // ── Dynamic daily target ───────────────────────────────────────────────────
  // Recalculate from deadline + remaining words so stale onboarding values
  // auto-correct after a long absence (e.g. skip a month → pace increases).

  const pool         = hasPaidAccess ? PAID_WORD_POOL : FREE_WORD_POOL;
  const masteredWords = breakdown.mastered + breakdown.strong;
  const remainingWords = Math.max(0, pool - masteredWords);

  let dynamicDailyTarget = progress.dailyTarget ?? 10;
  if (progress.deadline) {
    const msLeft   = progress.deadline.getTime() - Date.now();
    const daysLeft = Math.ceil(msLeft / 86_400_000);
    if (daysLeft > 0) {
      dynamicDailyTarget = Math.max(1, Math.ceil(remainingWords / daysLeft));
    }
  }

  const goalProgress = Math.min(100, Math.round((reviewedCount / dynamicDailyTarget) * 100));

  return {
    userName:         user.name,
    streakDays:       progress.streakDays,
    totalPoints:      progress.totalPoints,
    weeklyPoints:     progress.weeklyPoints,
    dueWordsCount,
    dailyTarget:      dynamicDailyTarget,
    goalProgress,
    deadline:         progress.deadline ? progress.deadline.toISOString() : null,
    lastStudyUnit:    lastSession[0]?.themeName ?? null,
    phase:            progress.phase,
    sessions,
    masteryBreakdown: breakdown,
    hasPaidAccess,
  };
}

export function getHomeData(email: string) {
  return unstable_cache(
    () => _getHomeData(email),
    ['vocab-home', email],
    { revalidate: 300, tags: [VocabCacheTag.home(email)] },
  )();
}

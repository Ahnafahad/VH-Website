import {
  db, users, userAccess, vocabUserProgress, vocabUserWordRecords,
  vocabFlashcardSessions, vocabThemes, vocabQuizSessions, vocabQuizAnswers, vocabWords,
  vocabSyllabuses, vocabUserSyllabuses,
} from '@/lib/db';
import { eq, and, lte, gte, gt, count, sql, inArray, min } from 'drizzle-orm';
import { FREE_WORD_POOL, PAID_WORD_POOL } from './constants';
import { unstable_cache } from 'next/cache';
import { VocabCacheTag } from './cache-keys';
import { dhakaWeekStart } from './dhaka-time';
import { sortByBriefingPriority, computeRequiredPace, computeRepeatOffenders, isResumeStale, type BriefingKind } from './briefing';
import type { WordPriorityInput } from './priority-score';
import { isAdminRole } from '@/lib/auth/roles';
import { getSyllabusCatalogVersion } from './syllabus-prompt';

export interface HomeRecommendation {
  kind:            BriefingKind;
  href:            string;
  action:          string;
  title:           string;
  reason:          string;
  durationMinutes: number;
  outcome:         string;
}

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
  weeklyRecallCount: number;
  weeklyRecallTarget: number;
  dueWordsCount:    number;
  dailyTarget:      number;
  goalProgress:     number;        // 0–100 percentage of today's target reviewed
  deadline:         string | null;
  lastStudyUnit:    string | null; // e.g. "Unit 3 · Theme 2"
  phase:            number;
  sessions:         SessionsData;
  masteryBreakdown: MasteryBreakdown;
  hasPaidAccess:    boolean;       // true if user has any active product or is admin
  recommendation:   HomeRecommendation;
  /** ISO timestamp of the earliest future SRS review date, or null. Used to schedule local notifications. */
  nextDueIso:       string | null;
  /** True when the student was upgraded to full access (phase 1) and hasn't set/dismissed a new target date yet. */
  promptFullAccessDeadline: boolean;
  /** Set when syllabuses exist that this user hasn't been asked about yet — drives the "choose your syllabus" interstitial. */
  newSyllabusPrompt: { syllabuses: { id: number; name: string; description: string | null }[] } | null;
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

  const [weeklyRecall] = await db.select({ value: count() })
    .from(vocabQuizAnswers)
    .where(and(
      eq(vocabQuizAnswers.userId, user.id),
      eq(vocabQuizAnswers.isCorrect, true),
      gte(vocabQuizAnswers.answeredAt, dhakaWeekStart()),
    ));

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
    activeQuizRows,
    nextDueResult,
    wordRecords,
    allSyllabuses,
    selectedSyllabusRows,
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

    db.select({
      id: vocabQuizSessions.id,
      themeId: vocabQuizSessions.themeId,
      sessionType: vocabQuizSessions.sessionType,
      total: vocabQuizSessions.totalQuestions,
      startedAt: vocabQuizSessions.startedAt,
      answered: sql<number>`count(${vocabQuizAnswers.id})`,
    })
      .from(vocabQuizSessions)
      .leftJoin(vocabQuizAnswers, eq(vocabQuizAnswers.sessionId, vocabQuizSessions.id))
      .where(and(eq(vocabQuizSessions.userId, user.id), eq(vocabQuizSessions.status, 'in_progress')))
      .groupBy(vocabQuizSessions.id)
      .orderBy(sql`${vocabQuizSessions.startedAt} DESC`)
      .limit(1),

    // Earliest future SRS review date (for local notification scheduling).
    db.select({ earliest: min(vocabUserWordRecords.srsNextReviewDate) })
      .from(vocabUserWordRecords)
      .where(and(
        eq(vocabUserWordRecords.userId, user.id),
        eq(vocabUserWordRecords.inSrsPool, true),
        gt(vocabUserWordRecords.srsNextReviewDate, now),
      )),

    // Per-word mastery records → feeds Repeat Offenders (shared with practice-data.ts
    // via computeRepeatOffenders, so Home and Practice always agree on the same words).
    db.select({
      wordId:            vocabUserWordRecords.wordId,
      masteryLevel:      vocabUserWordRecords.masteryLevel,
      masteryScore:      vocabUserWordRecords.masteryScore,
      accuracyRate:      vocabUserWordRecords.accuracyRate,
      lastSeenAt:        vocabUserWordRecords.lastSeenAt,
      srsNextReviewDate: vocabUserWordRecords.srsNextReviewDate,
      exposureCount:     vocabUserWordRecords.exposureCount,
    })
      .from(vocabUserWordRecords)
      .where(eq(vocabUserWordRecords.userId, user.id)),

    db.select({ id: vocabSyllabuses.id, name: vocabSyllabuses.name, description: vocabSyllabuses.description })
      .from(vocabSyllabuses)
      .orderBy(vocabSyllabuses.order),

    db.select({ syllabusId: vocabUserSyllabuses.syllabusId })
      .from(vocabUserSyllabuses)
      .where(eq(vocabUserSyllabuses.userId, user.id)),
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

  const isAdmin     = isAdminRole(user.role);
  const hasPaidAccess = isAdmin || accessRows.length > 0;

  const activeQuiz = activeQuizRows[0]
    && Number(activeQuizRows[0].answered ?? 0) > 0
    && !isResumeStale(activeQuizRows[0].startedAt, now)
    ? {
        id: activeQuizRows[0].id,
        href: activeQuizRows[0].sessionType === 'study' && activeQuizRows[0].themeId
          ? `/vocab/study/${activeQuizRows[0].themeId}/quiz`
          : '/vocab/practice/quiz',
        answered: Number(activeQuizRows[0].answered ?? 0),
        total: activeQuizRows[0].total,
      }
    : null;

  // ── Dynamic daily target ───────────────────────────────────────────────────
  // Recalculate from deadline + remaining words so stale onboarding values
  // auto-correct after a long absence (e.g. skip a month → pace increases).

  const pool         = hasPaidAccess ? PAID_WORD_POOL : FREE_WORD_POOL;
  const masteredWords = breakdown.mastered + breakdown.strong;
  const remainingWords = Math.max(0, pool - masteredWords);

  const { requiredPace, daysUntilDeadline } = computeRequiredPace(progress.deadline, remainingWords);
  const dynamicDailyTarget = requiredPace ?? (progress.dailyTarget ?? 10);

  // ── Today's Briefing — Home shows only the single highest-priority card ────

  const candidates: HomeRecommendation[] = [];

  if (activeQuiz) {
    const left = Math.max(1, activeQuiz.total - activeQuiz.answered);
    candidates.push({
      kind: 'resume', href: activeQuiz.href, action: 'Resume quiz',
      title: `Finish your ${left}-question recall check`,
      reason: 'Your answers are saved — pick the case back up where it stalled.',
      durationMinutes: Math.max(1, Math.ceil(left * 0.5)),
      outcome: 'Close the loop and update your mastery.',
    });
  }
  const priorityInputs: WordPriorityInput[] = wordRecords.map(r => ({
    wordId:            r.wordId,
    masteryLevel:      (r.masteryLevel ?? 'new') as WordPriorityInput['masteryLevel'],
    masteryScore:      r.masteryScore ?? 0,
    accuracyRate:      r.accuracyRate ?? 0,
    lastSeenAt:        r.lastSeenAt,
    srsNextReviewDate: r.srsNextReviewDate,
    exposureCount:     r.exposureCount ?? 0,
  }));
  const repeatOffenderIds = computeRepeatOffenders(priorityInputs);
  if (repeatOffenderIds.length > 0) {
    candidates.push({
      kind: 'repeat_offenders',
      href: `/vocab/practice/quiz?mode=briefing&wordIds=${repeatOffenderIds.join(',')}`,
      action: 'Open the case',
      title: `Repeat Offenders — ${repeatOffenderIds.length} words`,
      reason: 'These words keep slipping — the file has been open a while.',
      durationMinutes: Math.max(2, Math.ceil(repeatOffenderIds.length * 0.5)),
      outcome: 'Clear the backlog before it grows.',
    });
  }
  if (requiredPace !== null && remainingWords > 0) {
    candidates.push({
      kind: 'deadline_file', href: '/vocab/practice', action: 'Work the file',
      title: `The Deadline File — ${requiredPace} words today`,
      reason: `${daysUntilDeadline} day${daysUntilDeadline === 1 ? '' : 's'} left. This is today's assigned pace.`,
      durationMinutes: Math.max(3, Math.ceil(requiredPace * 0.5)),
      outcome: 'Stay on pace for your deadline.',
    });
  }
  if (quizSession) {
    candidates.push({
      kind: 'fresh', href: `/vocab/study/${quizSession.themeId}/quiz`, action: 'Test your recall',
      title: `Check what stayed from ${quizSession.name}`,
      reason: 'You have seen these words; tested recall is the next useful step.',
      durationMinutes: Math.max(3, Math.ceil(quizSession.wordCount * 0.5)),
      outcome: 'Turn exposure into measured mastery.',
    });
  }
  if (learnSession) {
    const inProgress = Boolean(inProgressTheme && inProgressTheme.id === learnSession.themeId);
    candidates.push({
      kind: 'fresh', href: `/vocab/study/${learnSession.themeId}`,
      action: inProgress ? 'Continue session' : 'Start learning',
      title: inProgress ? `Continue ${learnSession.name}` : `Open a new case: ${learnSession.name}`,
      reason: inProgress
        ? 'This set is already open — finishing it keeps the thread intact.'
        : 'Nothing urgent is pending — a good moment to open new ground.',
      durationMinutes: Math.max(4, Math.ceil(learnSession.wordCount * 0.45)),
      outcome: inProgress
        ? 'Finish learning this set and prepare its recall check.'
        : 'Learn a manageable set and prepare it for recall.',
    });
  }
  if (candidates.length === 0) {
    candidates.push({
      kind: 'fresh', href: '/vocab/study', action: 'Start learning',
      title: 'Begin a focused vocabulary session',
      reason: 'Your review queue is clear — a good moment to add a small set.',
      durationMinutes: 5,
      outcome: 'Learn a manageable set and prepare it for recall.',
    });
  }

  const recommendation = sortByBriefingPriority(candidates)[0];

  const goalProgress = Math.min(100, Math.round((reviewedCount / dynamicDailyTarget) * 100));

  const earliestFutureDue = nextDueResult[0]?.earliest;
  const nextDueIso = earliestFutureDue instanceof Date
    ? earliestFutureDue.toISOString()
    : typeof earliestFutureDue === 'string'
      ? earliestFutureDue
      : null;

  return {
    userName:         user.name,
    streakDays:       progress.streakDays,
    totalPoints:      progress.totalPoints,
    weeklyPoints:     progress.weeklyPoints,
    weeklyRecallCount: weeklyRecall?.value ?? 0,
    weeklyRecallTarget: 25,
    dueWordsCount,
    dailyTarget:      dynamicDailyTarget,
    goalProgress,
    deadline:         progress.deadline ? progress.deadline.toISOString() : null,
    lastStudyUnit:    lastSession[0]?.themeName ?? null,
    phase:            progress.phase,
    sessions,
    masteryBreakdown: breakdown,
    hasPaidAccess,
    recommendation,
    nextDueIso,
    promptFullAccessDeadline: progress.phase === 1 && progress.fullAccessDeadlineSetAt === null,
    newSyllabusPrompt: await getNewSyllabusPrompt(progress.lastAnnouncementSeen, allSyllabuses, selectedSyllabusRows),
  };
}

async function getNewSyllabusPrompt(
  lastSeen: string | null,
  allSyllabuses: { id: number; name: string; description: string | null }[],
  selectedRows: { syllabusId: number }[],
): Promise<HomeData['newSyllabusPrompt']> {
  // An empty selection already means unrestricted access to every syllabus,
  // current and future (see access-check.ts) — nothing to prompt these users
  // to "add". Only users who've already narrowed their selection need to be
  // told a newly-added syllabus isn't in it yet.
  if (selectedRows.length === 0) return null;

  const catalogVersion = await getSyllabusCatalogVersion();
  if (lastSeen === catalogVersion) return null;

  const selected = new Set(selectedRows.map(r => r.syllabusId));
  const missing  = allSyllabuses.filter(s => !selected.has(s.id));
  return missing.length > 0 ? { syllabuses: missing } : null;
}

export function getHomeData(email: string) {
  return unstable_cache(
    () => _getHomeData(email),
    ['vocab-home', email],
    { revalidate: 300, tags: [VocabCacheTag.home(email)] },
  )();
}

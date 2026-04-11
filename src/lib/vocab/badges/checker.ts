/**
 * Badge Checker — T27
 *
 * Call checkBadges() after any relevant action to award newly earned badges.
 * Returns the list of badges earned in this call (may be empty).
 *
 * Designed to run after the main action completes. Wrap in .catch(() => [])
 * so that badge-check failures never break the main API response.
 */

import { db } from '@/lib/db';
import {
  vocabUserBadges,
  vocabFlashcardSessions,
  vocabQuizSessions,
  vocabQuizAnswers,
  vocabUserWordRecords,
  vocabThemes,
  vocabWords,
  vocabAdminSettings,
} from '@/lib/db/schema';
import { eq, and, count, isNotNull, isNull, sql } from 'drizzle-orm';
import { BADGE_MAP } from './definitions';

// ─── Public types ─────────────────────────────────────────────────────────────

export type BadgeTrigger =
  | 'flashcard_complete'
  | 'quiz_complete'
  | 'streak_update'
  | 'leaderboard_weekly_reset';

export interface BadgeCheckContext {
  /** ID of the completed quiz session (quiz_complete trigger). */
  sessionId?:      number;
  /** Percentage score 0–100 (quiz_complete). */
  score?:          number;
  /** Whether the quiz was passed (quiz_complete). */
  passed?:         boolean;
  /** Number of correct answers (quiz_complete). */
  correctAnswers?: number;
  /** Total questions in the quiz (quiz_complete). */
  totalQuestions?: number;
  /** 'study' | 'practice' (quiz_complete). */
  sessionType?:    'study' | 'practice';
  /** Current streak length in days (streak_update). */
  streakDays?:     number;
  /** Longest streak ever reached (streak_update). */
  longestStreak?:  number;
  /** Rank on this week's leaderboard (leaderboard_weekly_reset). */
  weeklyRank?:     number;
}

export interface EarnedBadge {
  id:          string;
  name:        string;
  description: string;
  category:    'short_term' | 'mid_term' | 'long_term' | 'ultimate';
}

// ─── Per-request badge cache (avoids redundant loads within same request) ────

const badgeCache = new Map<number, { rows: { badgeId: string; earnedAt: Date | null; progress: number | null }[]; ts: number }>();
const BADGE_CACHE_TTL = 5_000; // 5 seconds — covers multiple calls within one request

function getCachedBadges(userId: number) {
  const cached = badgeCache.get(userId);
  if (cached && Date.now() - cached.ts < BADGE_CACHE_TTL) return cached.rows;
  return null;
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function checkBadges(
  userId:  number,
  trigger: BadgeTrigger,
  ctx:     BadgeCheckContext = {},
): Promise<EarnedBadge[]> {

  // Load all existing badge rows for this user (with short-lived cache).
  const cached = getCachedBadges(userId);
  const existingRows = cached ?? await db
    .select({
      badgeId:  vocabUserBadges.badgeId,
      earnedAt: vocabUserBadges.earnedAt,
      progress: vocabUserBadges.progress,
    })
    .from(vocabUserBadges)
    .where(eq(vocabUserBadges.userId, userId));
  if (!cached) badgeCache.set(userId, { rows: existingRows, ts: Date.now() });

  const earned      = new Set(existingRows.filter(r => r.earnedAt !== null).map(r => r.badgeId));
  const progressMap = new Map(existingRows.map(r => [r.badgeId, r.progress ?? 0]));

  // Check if ultimate achievements are visible.
  const [ultimateSetting] = await db
    .select({ value: vocabAdminSettings.value })
    .from(vocabAdminSettings)
    .where(eq(vocabAdminSettings.key, 'ultimate_achievements_visible'))
    .limit(1);
  const ultimateVisible = ultimateSetting?.value === 'true';

  const now         = new Date();
  const newlyEarned: EarnedBadge[] = [];

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /** Mark a badge as earned (upserts the row). */
  async function award(badgeId: string): Promise<void> {
    if (earned.has(badgeId)) return;
    const def = BADGE_MAP.get(badgeId);
    if (!def) return;
    if (def.category === 'ultimate' && !ultimateVisible) return;

    // On conflict: only update earnedAt (leave progress intact).
    await db
      .insert(vocabUserBadges)
      .values({ userId, badgeId, progress: 0, earnedAt: now })
      .onConflictDoUpdate({
        target: [vocabUserBadges.userId, vocabUserBadges.badgeId],
        set:    { earnedAt: now },
      });

    earned.add(badgeId);
    newlyEarned.push({ id: def.id, name: def.name, description: def.description, category: def.category });
  }

  /** Update progress counter without earning (skips already-earned badges). */
  async function setProgress(badgeId: string, progress: number): Promise<void> {
    if (earned.has(badgeId)) return;
    // On conflict: only update progress (leave earnedAt intact).
    await db
      .insert(vocabUserBadges)
      .values({ userId, badgeId, progress, earnedAt: null })
      .onConflictDoUpdate({
        target: [vocabUserBadges.userId, vocabUserBadges.badgeId],
        set:    { progress },
        where:  isNull(vocabUserBadges.earnedAt),
      });
    progressMap.set(badgeId, progress);
  }

  // ── Trigger: flashcard_complete ─────────────────────────────────────────────
  if (trigger === 'flashcard_complete') {

    // Count all completed flashcard sessions for this user.
    const [{ sessCount }] = await db
      .select({ sessCount: count() })
      .from(vocabFlashcardSessions)
      .where(and(
        eq(vocabFlashcardSessions.userId, userId),
        eq(vocabFlashcardSessions.status, 'complete'),
      ));

    // first_step: complete first flashcard session
    if (sessCount >= 1) await award('first_step');

    // review_regular: 30 sessions
    await setProgress('review_regular', sessCount);
    if (sessCount >= 30)  await award('review_regular');

    // review_legend: 200 sessions
    await setProgress('review_legend', sessCount);
    if (sessCount >= 200) await award('review_legend');

    // speed_demon: 5 sessions each under 3 minutes (180 seconds)
    // Timestamps are stored as unix epoch seconds, so difference < 180 = < 3 min.
    const [{ fastCount }] = await db
      .select({ fastCount: count() })
      .from(vocabFlashcardSessions)
      .where(and(
        eq(vocabFlashcardSessions.userId, userId),
        eq(vocabFlashcardSessions.status, 'complete'),
        isNotNull(vocabFlashcardSessions.completedAt),
        sql`(${vocabFlashcardSessions.completedAt} - ${vocabFlashcardSessions.startedAt}) < 180`,
      ));
    await setProgress('speed_demon', fastCount);
    if (fastCount >= 5) await award('speed_demon');

    // vocab_explorer: start flashcards for 8 different units
    const [{ unitCount }] = await db
      .select({ unitCount: sql<number>`COUNT(DISTINCT ${vocabThemes.unitId})` })
      .from(vocabFlashcardSessions)
      .innerJoin(vocabThemes, eq(vocabFlashcardSessions.themeId, vocabThemes.id))
      .where(eq(vocabFlashcardSessions.userId, userId));
    await setProgress('vocab_explorer', unitCount);
    if (unitCount >= 8) await award('vocab_explorer');
  }

  // ── Trigger: quiz_complete ──────────────────────────────────────────────────
  if (trigger === 'quiz_complete') {

    // Count all completed quiz sessions.
    const [{ quizCount }] = await db
      .select({ quizCount: count() })
      .from(vocabQuizSessions)
      .where(and(
        eq(vocabQuizSessions.userId, userId),
        eq(vocabQuizSessions.status, 'complete'),
      ));

    // quiz_starter: first quiz
    if (quizCount >= 1) await award('quiz_starter');

    // perfectionist: 100% on the quiz just completed
    if (!earned.has('perfectionist')) {
      const total   = ctx.totalQuestions ?? 0;
      const correct = ctx.correctAnswers ?? 0;
      if (total > 0 && correct === total) await award('perfectionist');
    }

    // analogy_apprentice / analogy_master: cumulative analogy correct answers
    const [{ analogyCorrect }] = await db
      .select({ analogyCorrect: count() })
      .from(vocabQuizAnswers)
      .where(and(
        eq(vocabQuizAnswers.userId, userId),
        eq(vocabQuizAnswers.questionType, 'analogy'),
        eq(vocabQuizAnswers.isCorrect, true),
      ));
    await setProgress('analogy_apprentice', analogyCorrect);
    if (analogyCorrect >= 25)  await award('analogy_apprentice');
    await setProgress('analogy_master', analogyCorrect);
    if (analogyCorrect >= 200) await award('analogy_master');

    // halfway_there / the_800_club: words reviewed at least once (have a word record)
    const [{ wordsCovered }] = await db
      .select({ wordsCovered: count() })
      .from(vocabUserWordRecords)
      .where(eq(vocabUserWordRecords.userId, userId));

    const [{ totalWords }] = await db
      .select({ totalWords: count() })
      .from(vocabWords);

    const halfwayThreshold = Math.max(1, Math.floor(totalWords / 2));
    await setProgress('halfway_there', wordsCovered);
    if (totalWords > 0 && wordsCovered >= halfwayThreshold) await award('halfway_there');
    await setProgress('the_800_club', wordsCovered);
    if (totalWords > 0 && wordsCovered >= totalWords) await award('the_800_club');

    // Total correct quiz answers (used by sharp_shooter + question_machine)
    const [{ totalCorrect }] = await db
      .select({ totalCorrect: count() })
      .from(vocabQuizAnswers)
      .where(and(
        eq(vocabQuizAnswers.userId, userId),
        eq(vocabQuizAnswers.isCorrect, true),
      ));

    // sharp_shooter: 50 consecutive correct quiz answers (tracked via badge progress)
    if (!earned.has('sharp_shooter') && ctx.sessionId !== undefined) {
      const sessionAnswers = await db
        .select({ isCorrect: vocabQuizAnswers.isCorrect })
        .from(vocabQuizAnswers)
        .where(eq(vocabQuizAnswers.sessionId, ctx.sessionId))
        .orderBy(vocabQuizAnswers.answeredAt);

      // Start from the previously persisted consecutive-correct streak.
      let streak  = progressMap.get('sharp_shooter') ?? 0;
      let reached = false;

      for (const ans of sessionAnswers) {
        if (ans.isCorrect) {
          streak++;
          if (streak >= 50) { reached = true; break; }
        } else {
          streak = 0;
        }
      }

      if (reached) {
        await award('sharp_shooter');
      } else {
        await setProgress('sharp_shooter', streak);
      }
    }

    // Unit completion checks ─────────────────────────────────────────────────
    // Fetch all themes and completed study quiz sessions in two queries.

    const allThemes = await db
      .select({ themeId: vocabThemes.id, unitId: vocabThemes.unitId })
      .from(vocabThemes);

    const completedStudyQuizzes = await db
      .select({
        themeId: vocabQuizSessions.themeId,
        passed:  vocabQuizSessions.passed,
        score:   vocabQuizSessions.score,
      })
      .from(vocabQuizSessions)
      .where(and(
        eq(vocabQuizSessions.userId, userId),
        eq(vocabQuizSessions.status, 'complete'),
        eq(vocabQuizSessions.sessionType, 'study'),
        isNotNull(vocabQuizSessions.themeId),
      ));

    const completedThemeIds = new Set(completedStudyQuizzes.map(q => q.themeId));
    const passedThemeIds    = new Set(completedStudyQuizzes.filter(q => q.passed).map(q => q.themeId));
    const perfectThemeIds   = new Set(completedStudyQuizzes.filter(q => q.score === 100).map(q => q.themeId));

    // Group themes by unit.
    const unitThemeMap = new Map<number, number[]>();
    for (const t of allThemes) {
      const arr = unitThemeMap.get(t.unitId) ?? [];
      arr.push(t.themeId);
      unitThemeMap.set(t.unitId, arr);
    }

    const allUnitIds    = [...unitThemeMap.keys()];
    const completeUnits = allUnitIds.filter(uid =>
      unitThemeMap.get(uid)!.every(tid => completedThemeIds.has(tid))
    );
    const passedUnits   = allUnitIds.filter(uid =>
      unitThemeMap.get(uid)!.every(tid => passedThemeIds.has(tid))
    );
    const perfectUnits  = allUnitIds.filter(uid =>
      unitThemeMap.get(uid)!.every(tid => perfectThemeIds.has(tid))
    );

    // unit_slayer: first complete unit
    await setProgress('unit_slayer', completeUnits.length);
    if (completeUnits.length >= 1) await award('unit_slayer');

    // unit_conqueror: ALL units complete
    await setProgress('unit_conqueror', completeUnits.length);
    if (allUnitIds.length > 0 && completeUnits.length === allUnitIds.length) {
      await award('unit_conqueror');
    }

    // completionist: ALL units have ALL quizzes passed
    await setProgress('completionist', passedUnits.length);
    if (allUnitIds.length > 0 && passedUnits.length === allUnitIds.length) {
      await award('completionist');
    }

    // ── Ultimate achievements (quiz) ─────────────────────────────────────────
    if (ultimateVisible) {

      // question_machine: 10,000 correct answers
      await setProgress('question_machine', totalCorrect);
      if (totalCorrect >= 10_000) await award('question_machine');

      // flawless_run: entire unit with 100% on every quiz
      if (perfectUnits.length >= 1) await award('flawless_run');

      // word_sovereign: mastery ≥151 AND longGapCorrect on ALL words
      if (!earned.has('word_sovereign')) {
        const [{ sovereignCount }] = await db
          .select({ sovereignCount: count() })
          .from(vocabUserWordRecords)
          .where(and(
            eq(vocabUserWordRecords.userId, userId),
            sql`${vocabUserWordRecords.masteryScore} >= 151`,
            eq(vocabUserWordRecords.longGapCorrect, true),
          ));
        await setProgress('word_sovereign', sovereignCount);
        if (totalWords > 0 && sovereignCount >= totalWords) await award('word_sovereign');
      }
    }
  }

  // ── Trigger: streak_update ──────────────────────────────────────────────────
  if (trigger === 'streak_update') {
    const streakDays    = ctx.streakDays    ?? 0;
    const longestStreak = ctx.longestStreak ?? 0;

    // on_a_roll: 3-day streak
    await setProgress('on_a_roll', streakDays);
    if (streakDays >= 3)  await award('on_a_roll');

    // week_warrior: 7-day streak
    await setProgress('week_warrior', streakDays);
    if (streakDays >= 7)  await award('week_warrior');

    // streak_keeper: 14-day streak
    await setProgress('streak_keeper', streakDays);
    if (streakDays >= 14) await award('streak_keeper');

    // immortal: 90 consecutive days (tracked via longestStreak, ultimate)
    if (ultimateVisible) {
      await setProgress('immortal', longestStreak);
      if (longestStreak >= 90) await award('immortal');
    }
  }

  // ── Trigger: leaderboard_weekly_reset ──────────────────────────────────────
  if (trigger === 'leaderboard_weekly_reset') {
    const rank = ctx.weeklyRank;
    if (rank !== undefined) {
      // leaderboard_climber: top 10
      if (rank <= 10) await award('leaderboard_climber');
      // leaderboard_legend: top 3
      if (rank <= 3)  await award('leaderboard_legend');
    }
  }

  // Invalidate cache if any badges were awarded/updated
  if (newlyEarned.length > 0) badgeCache.delete(userId);

  return newlyEarned;
}

/**
 * GET /api/vocab/quiz/summary/[sessionId]
 *
 * Finalises the quiz session (if not yet done), calculates pass/fail,
 * awards completion bonus points, and returns full results.
 *
 * Returns:
 *   { sessionId, score, total, passed, passThreshold, pointsAwarded,
 *     questions: [{ ...question, userAnswer, isCorrect, explanation }] }
 */

import { NextRequest } from 'next/server';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  users,
  vocabQuizSessions,
  vocabQuizAnswers,
  vocabUserProgress,
  vocabAdminSettings,
  vocabWords,
  vocabThemes,
} from '@/lib/db/schema';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';
import type { GeneratedQuestion } from '@/lib/vocab/quiz-generator';
import { checkBadges } from '@/lib/vocab/badges/checker';

const DEFAULT_PASS_THRESHOLD = 0.70;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();
    const { sessionId: sessionIdStr } = await params;
    const sessionId = parseInt(sessionIdStr, 10);
    if (isNaN(sessionId)) throw new ApiException('Invalid sessionId', 400);

    // Resolve user
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!user) throw new ApiException('User not found', 404);

    // Load session
    const [session] = await db
      .select()
      .from(vocabQuizSessions)
      .where(
        and(
          eq(vocabQuizSessions.id, sessionId),
          eq(vocabQuizSessions.userId, user.id),
        )
      )
      .limit(1);
    if (!session) throw new ApiException('Session not found', 404);

    // Load stored questions (includes correctLetter + explanation — now safe to reveal)
    const questions = JSON.parse(session.questions) as GeneratedQuestion[];

    // Load all answers for this session
    const answers = await db
      .select()
      .from(vocabQuizAnswers)
      .where(eq(vocabQuizAnswers.sessionId, sessionId));

    const answerMap = new Map(answers.map(a => [a.wordId, a]));

    // Get pass threshold from admin settings
    const [thresholdSetting] = await db
      .select({ value: vocabAdminSettings.value })
      .from(vocabAdminSettings)
      .where(eq(vocabAdminSettings.key, 'quiz_pass_threshold'))
      .limit(1);
    const passThreshold = thresholdSetting
      ? parseFloat(thresholdSetting.value)
      : DEFAULT_PASS_THRESHOLD;

    const correct = session.correctAnswers;
    const total   = session.totalQuestions;
    const score   = total > 0 ? correct / total : 0;
    const passed  = score >= passThreshold;

    // Finalise session if not already complete
    let bonusPoints       = 0;
    let unitBonus         = 0;
    const wasAlreadyComplete = session.status === 'complete';

    if (!wasAlreadyComplete) {
      // Quiz completion bonus per PRD Module 10
      // Study: pass → +25, no-pass → +10 | Practice (SRS review): always +10
      bonusPoints = session.sessionType === 'practice'
        ? 10
        : (passed ? 25 : 10);

      // Mark session complete first so unit-complete check sees the updated state
      await db
        .update(vocabQuizSessions)
        .set({
          status:      'complete',
          score:       Math.round(score * 100),
          passed,
          completedAt: new Date(),
        })
        .where(eq(vocabQuizSessions.id, sessionId));

      // Unit complete bonus (+50) — study sessions only, when all themes in the
      // unit now have at least one completed study quiz.
      if (session.sessionType === 'study' && session.themeId) {
        const [theme] = await db
          .select({ unitId: vocabThemes.unitId })
          .from(vocabThemes)
          .where(eq(vocabThemes.id, session.themeId))
          .limit(1);

        if (theme) {
          const allUnitThemes = await db
            .select({ id: vocabThemes.id })
            .from(vocabThemes)
            .where(eq(vocabThemes.unitId, theme.unitId));

          const allThemeIds = allUnitThemes.map(t => t.id);

          if (allThemeIds.length > 0) {
            // Count distinct themes with ≥1 completed study quiz in this unit
            const doneRows = await db
              .select({ themeId: vocabQuizSessions.themeId })
              .from(vocabQuizSessions)
              .where(
                and(
                  eq(vocabQuizSessions.userId, user.id),
                  eq(vocabQuizSessions.status, 'complete'),
                  eq(vocabQuizSessions.sessionType, 'study'),
                  inArray(vocabQuizSessions.themeId, allThemeIds),
                )
              )
              .groupBy(vocabQuizSessions.themeId);

            if (doneRows.length === allThemeIds.length) {
              unitBonus = 50;
            }
          }
        }
      }

      const totalBonus = bonusPoints + unitBonus;
      if (totalBonus > 0) {
        await db
          .update(vocabUserProgress)
          .set({
            totalPoints:  sql`total_points  + ${totalBonus}`,
            weeklyPoints: sql`weekly_points + ${totalBonus}`,
            updatedAt:    new Date(),
          })
          .where(eq(vocabUserProgress.userId, user.id));
      }
    }

    // Fetch word details for selectedWordId (for wrong answers display)
    const selectedWordIds = answers
      .filter(a => !a.isCorrect && a.selectedWordId)
      .map(a => a.selectedWordId as number);
    const selectedWords = selectedWordIds.length > 0
      ? await db
          .select({ id: vocabWords.id, word: vocabWords.word })
          .from(vocabWords)
          .where(inArray(vocabWords.id, selectedWordIds))
      : [];
    const selectedWordMap = new Map(selectedWords.map(w => [w.id, w.word]));

    // Build rich question results
    const questionResults = questions.map(q => {
      const answer = answerMap.get(q.correctWordId);
      return {
        id:            q.id,
        type:          q.type,
        questionText:  q.questionText,
        options:       q.options,
        correctLetter: q.correctLetter,
        correctWordId: q.correctWordId,
        explanation:   q.explanation,
        userAnswer: answer
          ? {
              selectedWordId: answer.selectedWordId,
              selectedWord:   answer.selectedWordId
                ? (selectedWordMap.get(answer.selectedWordId) ?? null)
                : null,
              isCorrect:  answer.isCorrect,
              pointsEarned: answer.pointsEarned,
            }
          : null, // not yet answered
      };
    });

    // Check quiz-related badges on first completion (never fail the response).
    const earnedBadges = wasAlreadyComplete
      ? []
      : await checkBadges(user.id, 'quiz_complete', {
          sessionId:      sessionId,
          score:          Math.round(score * 100),
          passed,
          correctAnswers: correct,
          totalQuestions: total,
          sessionType:    session.sessionType as 'study' | 'practice',
        }).catch((err) => { console.error('[badge-check:quiz]', err); return []; });

    return {
      sessionId,
      sessionType:    session.sessionType,
      correctAnswers: correct,
      totalQuestions: total,
      scorePct:       Math.round(score * 100),
      passed,
      passThreshold:  Math.round(passThreshold * 100),
      bonusPoints,
      unitBonus,
      questions:      questionResults,
      earnedBadges,
    };
  });
}

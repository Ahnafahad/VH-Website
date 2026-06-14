/**
 * GET /api/math/dashboard
 *
 * Returns the user's math dashboard payload — progress rollup, personal bests,
 * operation × tier heatmap (from last 500 attempts), improvement curve
 * (last 20 completed sessions), weakest spot, and 10 most recent sessions.
 */

import { and, desc, eq } from 'drizzle-orm';
import {
  db, users, mathSessions, mathQuestionAttempts, mathUserProgress,
  type MathOperation, type MathSession, type MathQuestionAttempt, type MathUserProgress,
} from '@/lib/db';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';
import { OPERATIONS, TIER_LIST, bucketDifficulty, type Tier } from '@/lib/math/constants';

type HeatCell = {
  operation: MathOperation;
  tier:      Tier;
  attempts:  number;
  correct:   number;
  accuracy:  number;   // 0–1, only meaningful when attempts > 0
};

const ATTEMPT_SAMPLE_CAP = 500;
const CURVE_SAMPLE       = 20;
const RECENT_SAMPLE      = 10;

export async function GET(): Promise<Response> {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    if (!user) throw new ApiException('User not found', 404);

    // Fan out three reads in parallel.
    const [progressRow, completedSessions, recentAttempts] = await Promise.all([
      db.select().from(mathUserProgress)
        .where(eq(mathUserProgress.userId, user.id))
        .limit(1)
        .then((rows): MathUserProgress | null => rows[0] ?? null),

      db.select().from(mathSessions)
        .where(and(eq(mathSessions.userId, user.id), eq(mathSessions.status, 'complete')))
        .orderBy(desc(mathSessions.finishedAt))
        .limit(Math.max(CURVE_SAMPLE, RECENT_SAMPLE))
        .then((rows): MathSession[] => rows),

      db.select().from(mathQuestionAttempts)
        .where(eq(mathQuestionAttempts.userId, user.id))
        .orderBy(desc(mathQuestionAttempts.answeredAt))
        .limit(ATTEMPT_SAMPLE_CAP)
        .then((rows): MathQuestionAttempt[] => rows),
    ]);

    // ── Progress ────────────────────────────────────────────────────────────
    const progress = progressRow ? {
      totalGames:       progressRow.totalGames,
      totalQuestions:   progressRow.totalQuestions,
      totalCorrect:     progressRow.totalCorrect,
      overallAccuracy:  progressRow.overallAccuracy,
      bestScore:        progressRow.bestScore,
      skill: {
        addition:       progressRow.skillAddition,
        subtraction:    progressRow.skillSubtraction,
        multiplication: progressRow.skillMultiplication,
        division:       progressRow.skillDivision,
      },
      preferredDifficulty: progressRow.preferredDifficulty,
    } : null;

    // ── Heatmap: operation × tier accuracy from last N attempts ─────────────
    const heatmap: HeatCell[] = [];
    for (const op of OPERATIONS) {
      for (const tier of TIER_LIST) {
        heatmap.push({ operation: op, tier, attempts: 0, correct: 0, accuracy: 0 });
      }
    }
    const cellIndex = new Map<string, HeatCell>();
    for (const cell of heatmap) cellIndex.set(`${cell.operation}|${cell.tier}`, cell);

    let fastestAvgMs = Infinity;
    let totalRtMs    = 0;
    let totalAttempts = 0;
    for (const a of recentAttempts) {
      const tier = bucketDifficulty(a.difficulty);
      const cell = cellIndex.get(`${a.operation}|${tier}`);
      if (cell) {
        cell.attempts += 1;
        if (a.isCorrect) cell.correct += 1;
      }
      if (!a.wasSkipped) {
        totalRtMs += a.responseTimeMs;
        totalAttempts += 1;
      }
    }
    for (const cell of heatmap) {
      cell.accuracy = cell.attempts > 0 ? cell.correct / cell.attempts : 0;
    }
    if (totalAttempts > 0) fastestAvgMs = totalRtMs / totalAttempts;

    // ── Improvement curve: last 20 completed sessions, oldest → newest ──────
    const curve = completedSessions
      .slice(0, CURVE_SAMPLE)
      .slice()
      .reverse()
      .map((s) => ({
        sessionId:  s.id,
        finishedAt: s.finishedAt ? s.finishedAt.toISOString() : null,
        score:      s.totalScore,
        accuracy:   s.questionsAnswered > 0
          ? Math.round((s.questionsCorrect / s.questionsAnswered) * 100)
          : 0,
      }));

    // ── Bests (single-session) ──────────────────────────────────────────────
    let bestSessionAccuracy = 0;
    for (const s of completedSessions) {
      if (s.questionsAnswered < 5) continue;  // noise gate
      const acc = Math.round((s.questionsCorrect / s.questionsAnswered) * 100);
      if (acc > bestSessionAccuracy) bestSessionAccuracy = acc;
    }

    const bests = {
      bestScore:        progressRow?.bestScore ?? 0,
      bestAccuracy:     bestSessionAccuracy,
      fastestAvgMs:     Number.isFinite(fastestAvgMs) ? Math.round(fastestAvgMs) : null,
      totalGames:       progressRow?.totalGames ?? 0,
    };

    // ── Weak spot: operation with lowest accuracy (min 8 attempts) ──────────
    let weakSpot: { operation: MathOperation; accuracy: number; tier: Tier; attempts: number } | null = null;
    for (const op of OPERATIONS) {
      const cells = TIER_LIST.map((t) => cellIndex.get(`${op}|${t}`)!).filter((c) => c.attempts > 0);
      const total = cells.reduce((acc, c) => acc + c.attempts, 0);
      if (total < 8) continue;
      const correct = cells.reduce((acc, c) => acc + c.correct, 0);
      const accuracy = correct / total;
      if (!weakSpot || accuracy < weakSpot.accuracy) {
        // Pick the tier within this op with most attempts (where the user clearly practices)
        const focusCell = cells.reduce((a, b) => (b.attempts > a.attempts ? b : a));
        weakSpot = { operation: op, accuracy, tier: focusCell.tier, attempts: total };
      }
    }

    // ── Recent sessions table ───────────────────────────────────────────────
    const recentSessions = completedSessions.slice(0, RECENT_SAMPLE).map((s) => ({
      id:               s.id,
      finishedAt:       s.finishedAt ? s.finishedAt.toISOString() : null,
      operations:       JSON.parse(s.operations) as MathOperation[],
      startDifficulty:  s.startDifficulty,
      adaptive:         s.adaptive,
      totalScore:       s.totalScore,
      questionsAnswered: s.questionsAnswered,
      questionsCorrect:  s.questionsCorrect,
      accuracy: s.questionsAnswered > 0
        ? Math.round((s.questionsCorrect / s.questionsAnswered) * 100)
        : 0,
      timeLimit: s.timeLimit,
    }));

    return {
      progress,
      bests,
      heatmap,
      curve,
      weakSpot,
      recentSessions,
    };
  });
}

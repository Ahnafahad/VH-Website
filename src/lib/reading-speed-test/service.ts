/**
 * Server-side logic for the reading speed test. Passage content is static
 * (src/data/reading-speed-passages.ts) — this module owns grading, WPM math,
 * and the DB reads/writes for attempts.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import { readingSpeedAttempts, users } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { READING_SPEED_PASSAGES, type ReadingSpeedPassage } from '@/data/reading-speed-passages';
import { ApiException } from '@/lib/api-utils';
import type {
  ReadingSpeedPassageForTaking, ReadingSpeedSubmitAnswer,
  ReadingSpeedAttemptResult, ReadingSpeedLeaderboardRow, ReadingSpeedAdminAttemptRow,
} from './types';

const START_TOKEN_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour — generous, just bounds abandoned sessions.

/**
 * The client can't be trusted to self-report reading time (it's the leaderboard's
 * ranking metric), so /start issues this HMAC-signed token carrying the server's own
 * clock reading. /submit verifies it and derives elapsed time from the server clock,
 * never from anything the client sent.
 */
export function createStartToken(userId: number, passageId: string): string {
  const body = Buffer.from(JSON.stringify({ userId, passageId, startedAt: Date.now() })).toString('base64url');
  const sig = createHmac('sha256', process.env.NEXTAUTH_SECRET!).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyStartToken(token: string, userId: number, passageId: string): number {
  const [body, sig] = String(token).split('.');
  if (!body || !sig) throw new ApiException('Invalid or missing start token', 400);
  const expectedSig = createHmac('sha256', process.env.NEXTAUTH_SECRET!).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    throw new ApiException('Invalid start token', 400);
  }
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (payload.userId !== userId || payload.passageId !== passageId) throw new ApiException('Start token does not match this attempt', 400);
  const elapsedMs = Date.now() - payload.startedAt;
  if (elapsedMs < 0 || elapsedMs > START_TOKEN_MAX_AGE_MS) throw new ApiException('Start token expired — start a new test', 400);
  return elapsedMs;
}

/** Brysbaert et al. (2019) meta-analysis: adult silent nonfiction reading average. */
export const READING_SPEED_BENCHMARK_WPM = 238;
export const READING_SPEED_BENCHMARK_RANGE: [number, number] = [175, 300];

function countWords(body: string): number {
  return body.trim().split(/\s+/).filter(Boolean).length;
}

export function pickRandomPassage(): ReadingSpeedPassage {
  return READING_SPEED_PASSAGES[Math.floor(Math.random() * READING_SPEED_PASSAGES.length)];
}

export function getPassageById(id: string): ReadingSpeedPassage | null {
  return READING_SPEED_PASSAGES.find(p => p.id === id) ?? null;
}

export function sanitizePassage(passage: ReadingSpeedPassage): ReadingSpeedPassageForTaking {
  return {
    id: passage.id,
    title: passage.title,
    body: passage.body,
    wordCount: countWords(passage.body),
    questions: passage.questions.map(q => ({ id: q.id, question: q.question, options: q.options })),
  };
}

export async function submitAttempt(
  userId: number,
  passageId: string,
  readingMs: number,
  answers: ReadingSpeedSubmitAnswer[],
  visibilityInterruptions: number,
): Promise<ReadingSpeedAttemptResult> {
  const passage = getPassageById(passageId);
  if (!passage) throw new ApiException('Passage not found', 404, 'PASSAGE_NOT_FOUND');

  const answerByQuestion = new Map(answers.map(a => [a.questionId, a.selectedIndex]));
  let correctCount = 0;
  const questionResults = passage.questions.map(q => {
    const selectedIndex = answerByQuestion.get(q.id) ?? null;
    const isCorrect = selectedIndex === q.correctIndex;
    if (isCorrect) correctCount++;
    return {
      questionId: q.id, type: q.type, question: q.question, options: q.options,
      correctIndex: q.correctIndex, selectedIndex, isCorrect,
    };
  });

  const wordCount = countWords(passage.body);
  // Guard a near-zero/garbage duration (e.g. a replayed request) from producing an absurd WPM.
  const safeMs = Math.max(readingMs, 1000);
  const rawWpm = Math.round((wordCount * 60000) / safeMs);
  const totalQuestions = passage.questions.length;
  const comprehensionPct = Math.round((correctCount / totalQuestions) * 100);
  const verified = correctCount >= 4;
  const confidence =
    visibilityInterruptions > 0 || correctCount <= 3 ? 'low'
    : correctCount === totalQuestions ? 'high'
    : 'good';

  await db.insert(readingSpeedAttempts).values({
    userId, passageId, wordCount, readingMs, rawWpm,
    correctCount, totalQuestions, verified, visibilityInterruptions,
  });

  return {
    passageTitle: passage.title, wordCount, rawWpm, correctCount, totalQuestions,
    comprehensionPct, verified, confidence, questionResults,
  };
}

export async function getLeaderboard(userId: number): Promise<ReadingSpeedLeaderboardRow[]> {
  const rows = await db.select({
    userId: readingSpeedAttempts.userId,
    name: users.name,
    bestWpm: sql<number>`max(${readingSpeedAttempts.rawWpm})`,
  }).from(readingSpeedAttempts)
    .innerJoin(users, eq(users.id, readingSpeedAttempts.userId))
    .where(eq(readingSpeedAttempts.verified, true))
    .groupBy(readingSpeedAttempts.userId)
    .orderBy(desc(sql`max(${readingSpeedAttempts.rawWpm})`));

  const ranked: ReadingSpeedLeaderboardRow[] = rows.map((r, i) => ({
    rank: i + 1, userId: r.userId, name: r.name, bestWpm: r.bestWpm, isMe: r.userId === userId,
  }));

  const top5 = ranked.slice(0, 5);
  const mine = ranked.find(r => r.isMe);
  if (mine && !top5.some(r => r.isMe)) top5.push(mine);
  return top5;
}

export async function listAllAttemptsForAdmin(): Promise<ReadingSpeedAdminAttemptRow[]> {
  const rows = await db.select({
    id: readingSpeedAttempts.id,
    userId: readingSpeedAttempts.userId,
    name: users.name,
    email: users.email,
    passageId: readingSpeedAttempts.passageId,
    rawWpm: readingSpeedAttempts.rawWpm,
    correctCount: readingSpeedAttempts.correctCount,
    totalQuestions: readingSpeedAttempts.totalQuestions,
    verified: readingSpeedAttempts.verified,
    createdAt: readingSpeedAttempts.createdAt,
  }).from(readingSpeedAttempts)
    .innerJoin(users, eq(users.id, readingSpeedAttempts.userId))
    .orderBy(desc(readingSpeedAttempts.createdAt));

  return rows.map(r => ({
    id: r.id, userId: r.userId, name: r.name, email: r.email,
    passageTitle: getPassageById(r.passageId)?.title ?? r.passageId,
    rawWpm: r.rawWpm, correctCount: r.correctCount, totalQuestions: r.totalQuestions,
    verified: r.verified, createdAt: r.createdAt.getTime(),
  }));
}

export async function resetAllAttempts(): Promise<void> {
  await db.delete(readingSpeedAttempts);
}

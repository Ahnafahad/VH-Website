/**
 * POST /api/vocab/quiz/generate
 *
 * Generates a quiz session (study or practice).
 *
 * Body (study):
 *   { type: 'study', themeId: number }
 *
 * Body (practice):
 *   { type: 'practice', unitIds: number[] }
 *
 * Returns: { sessionId, questions }
 * Questions do NOT reveal the correct answer — correctLetter is omitted from the response.
 */

import { NextRequest } from 'next/server';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  users,
  vocabWords,
  vocabThemes,
  vocabUserWordRecords,
  vocabConfusionPairs,
  vocabQuizSessions,
  vocabUserProgress,
} from '@/lib/db/schema';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';
import { rateLimit } from '@/lib/rate-limit';
import { selectDistractors }   from '@/lib/vocab/distractor-selector';
import {
  generateQuizQuestions,
  resolveStudentLevel,
  pickQuestionTypes,
} from '@/lib/vocab/quiz-generator';
import {
  rankByPriority,
  weightedSample,
} from '@/lib/vocab/priority-score';
import type { WordForDistractor } from '@/lib/vocab/distractor-selector';
import type { VocabQuestionType } from '@/lib/db/schema';
import type { QuizQuestionInput, DifficultyLevel } from '@/lib/vocab/quiz-generator';

// ─── Constants ────────────────────────────────────────────────────────────────

const STUDY_MAX_QUESTIONS    = 10;
const PRACTICE_MAX_QUESTIONS = 20;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function toWordForDistractor(w: {
  id: number; word: string; definition: string; synonyms: string;
  antonyms: string; exampleSentence: string; partOfSpeech: string;
  themeId: number; unitId: number; difficultyBase: number;
}): WordForDistractor {
  return {
    id:              w.id,
    word:            w.word,
    definition:      w.definition,
    synonyms:        JSON.parse(w.synonyms) as string[],
    antonyms:        JSON.parse(w.antonyms) as string[],
    exampleSentence: w.exampleSentence,
    partOfSpeech:    w.partOfSpeech,
    themeId:         w.themeId,
    unitId:          w.unitId,
    difficultyBase:  w.difficultyBase,
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();

    // Rate limit: 10 quiz generations per hour per user (AI API cost + abuse prevention)
    if (!rateLimit(`${email}:quiz_generate`, 10, 60 * 60_000)) {
      throw new ApiException('Rate limit exceeded', 429);
    }

    const body = await req.json() as unknown;
    if (typeof body !== 'object' || body === null) {
      throw new ApiException('Invalid request body', 400);
    }
    const { type } = body as Record<string, unknown>;

    // Resolve user
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!user) throw new ApiException('User not found', 404);

    // Get user progress (for student level + phase)
    const [progress] = await db
      .select()
      .from(vocabUserProgress)
      .where(eq(vocabUserProgress.userId, user.id))
      .limit(1);

    // ── Study quiz ────────────────────────────────────────────────────────────
    if (type === 'study') {
      const { themeId } = body as { themeId: unknown };
      if (typeof themeId !== 'number') {
        throw new ApiException('themeId must be a number', 400);
      }

      // Fetch all words in the theme
      const rawWords = await db
        .select()
        .from(vocabWords)
        .where(eq(vocabWords.themeId, themeId));

      if (rawWords.length === 0) {
        throw new ApiException('No words found for this theme', 404);
      }

      // Use client-supplied questionCount (validated), capped to theme size and STUDY_MAX_QUESTIONS
      const rawQCount = (body as Record<string, unknown>).questionCount;
      const requestedCount: number = typeof rawQCount === 'number' && [10, 15, 20].includes(rawQCount)
        ? rawQCount
        : STUDY_MAX_QUESTIONS;
      const questionCount = Math.min(requestedCount, rawWords.length, STUDY_MAX_QUESTIONS);

      // For the full pool (distractors come from all DB words, not just this theme)
      const allWords = await db.select().from(vocabWords);
      // Shuffle so every quiz picks a different subset when theme > STUDY_MAX_QUESTIONS
      const correctWords = shuffle(rawWords).slice(0, questionCount).map(toWordForDistractor);
      const pool        = allWords.map(toWordForDistractor);

      return buildSession({
        userId:         user.id,
        themeId,
        sessionType:    'study',
        correctWords,
        pool,
        progress,
        userEmail:      email,
      });
    }

    // ── Practice quiz ─────────────────────────────────────────────────────────
    if (type === 'practice') {
      const { themeIds } = body as { themeIds: unknown };
      if (!Array.isArray(themeIds) || themeIds.length === 0) {
        throw new ApiException('themeIds must be a non-empty array', 400);
      }

      // Fetch all words in selected themes
      const rawWords = await db
        .select()
        .from(vocabWords)
        .where(inArray(vocabWords.themeId, themeIds as number[]));

      if (rawWords.length === 0) {
        throw new ApiException('No words found for the selected themes', 404);
      }

      // Get per-word user records for priority scoring
      const wordIds = rawWords.map(w => w.id);
      const records = await db
        .select()
        .from(vocabUserWordRecords)
        .where(
          and(
            eq(vocabUserWordRecords.userId, user.id),
            inArray(vocabUserWordRecords.wordId, wordIds),
          )
        );
      const recordMap = new Map(records.map(r => [r.wordId, r]));

      // Build priority inputs
      const priorityInputs = rawWords.map(w => {
        const rec = recordMap.get(w.id);
        return {
          wordId:            w.id,
          masteryLevel:      (rec?.masteryLevel ?? 'new') as import('@/lib/db/schema').VocabMasteryLevel,
          masteryScore:      rec?.masteryScore ?? 0,
          accuracyRate:      rec?.accuracyRate ?? 0,
          lastSeenAt:        rec?.lastSeenAt ?? null,
          srsNextReviewDate: rec?.srsNextReviewDate ?? null,
          exposureCount:     rec?.exposureCount ?? 0,
        };
      });

      const rawQCount2 = (body as Record<string, unknown>).questionCount;
      const practiceCount = typeof rawQCount2 === 'number' && [10, 15, 20].includes(rawQCount2)
        ? rawQCount2 : PRACTICE_MAX_QUESTIONS;

      const ranked   = rankByPriority(priorityInputs);
      const selected = weightedSample(ranked, practiceCount);

      const correctWords = selected.map(s => {
        const raw = rawWords.find(w => w.id === s.wordId);
        if (!raw) throw new ApiException(`Word ${s.wordId} not found in pool`, 500);
        return toWordForDistractor(raw);
      });
      const pool = rawWords.map(toWordForDistractor);

      return buildSession({
        userId:      user.id,
        themeId:     null,
        sessionType: 'practice',
        correctWords,
        pool,
        progress,
        userEmail:   email,
      });
    }

    // ── Letter quiz ────────────────────────────────────────────────────────────
    if (type === 'letter') {
      const { wordIds } = body as { wordIds: unknown };
      if (!Array.isArray(wordIds) || wordIds.length === 0) {
        throw new ApiException('wordIds must be a non-empty array', 400);
      }

      const rawWords = await db
        .select()
        .from(vocabWords)
        .where(inArray(vocabWords.id, wordIds as number[]));

      if (rawWords.length === 0) {
        throw new ApiException('No words found for the provided wordIds', 404);
      }

      const rawQCount = (body as Record<string, unknown>).questionCount;
      const requestedCount: number = typeof rawQCount === 'number' && [10, 15, 20].includes(rawQCount)
        ? rawQCount : STUDY_MAX_QUESTIONS;
      const questionCount = Math.min(requestedCount, rawWords.length, STUDY_MAX_QUESTIONS);

      const allWords    = await db.select().from(vocabWords);
      const correctWords = shuffle(rawWords).slice(0, questionCount).map(toWordForDistractor);
      const pool         = allWords.map(toWordForDistractor);

      return buildSession({
        userId:      user.id,
        themeId:     null,
        sessionType: 'practice', // letter sessions reuse practice type in DB
        correctWords,
        pool,
        progress,
        userEmail:   email,
      });
    }

    throw new ApiException('type must be "study", "practice", or "letter"', 400);
  });
}

// ─── Shared session builder ───────────────────────────────────────────────────

interface BuildSessionParams {
  userId:      number;
  themeId:     number | null;
  sessionType: 'study' | 'practice';
  correctWords: WordForDistractor[];
  pool:        WordForDistractor[];
  progress:    { totalPoints: number; streakDays: number } | undefined;
  userEmail:   string;
}

async function buildSession({
  userId,
  themeId,
  sessionType,
  correctWords,
  pool,
  progress,
}: BuildSessionParams) {
  // Get confusion pairs (word_a = correct word)
  const correctIds = correctWords.map(w => w.id);

  const confusionRows = correctIds.length > 0
    ? await db
        .select()
        .from(vocabConfusionPairs)
        .where(
          and(
            eq(vocabConfusionPairs.userId, userId),
            inArray(vocabConfusionPairs.wordAId, correctIds),
          )
        )
    : [];

  // Group confusion pairs by wordAId
  const confusionByWord = new Map<number, { wordBId: number; count: number }[]>();
  for (const row of confusionRows) {
    const existing = confusionByWord.get(row.wordAId) ?? [];
    existing.push({ wordBId: row.wordBId, count: row.count });
    confusionByWord.set(row.wordAId, existing);
  }

  // Get total quiz answers for personalisation
  // (approximate: sum of total_attempts across all word records)
  const recordsAgg = await db
    .select({ totalAttempts: vocabUserWordRecords.totalAttempts })
    .from(vocabUserWordRecords)
    .where(eq(vocabUserWordRecords.userId, userId));
  const totalAnswers = recordsAgg.reduce((s, r) => s + (r.totalAttempts ?? 0), 0);

  // Resolve student level
  // Count completed themes by checking quiz sessions with status 'complete'
  const completedSessions = await db
    .select({ themeId: vocabQuizSessions.themeId })
    .from(vocabQuizSessions)
    .where(
      and(
        eq(vocabQuizSessions.userId, userId),
        eq(vocabQuizSessions.status, 'complete'),
      )
    );
  // Filter out null themeIds — practice sessions have themeId = null
  const completedThemes = new Set(
    completedSessions.map(s => s.themeId).filter((id): id is number => id !== null)
  ).size;

  // Count total themes directly from vocabThemes (efficient)
  const allThemesCount = (
    await db.select({ id: vocabThemes.id }).from(vocabThemes)
  ).length;

  const studentLevel = resolveStudentLevel(completedThemes, allThemesCount);

  // Build quiz inputs
  const questionTypes = pickQuestionTypes(correctWords.length, studentLevel);
  const initialDifficulty: DifficultyLevel = 'easy';

  const inputs: QuizQuestionInput[] = correctWords.map((correct, i) => {
    const confusionPairs = confusionByWord.get(correct.id) ?? [];
    const selection = selectDistractors(correct, pool, confusionPairs, totalAnswers);
    return {
      correct,
      selection,
      type:       questionTypes[i] as VocabQuestionType,
      difficulty: initialDifficulty,
    };
  });

  // Call AI — DeepSeek primary, Gemini fallback (may throw — safeApiHandler will catch)
  const generated = await generateQuizQuestions(inputs, studentLevel);

  // Persist session
  const questionsJson = JSON.stringify(generated);
  const [session] = await db
    .insert(vocabQuizSessions)
    .values({
      userId,
      themeId,
      sessionType,
      questions:      questionsJson,
      status:         'in_progress',
      totalQuestions: generated.length,
      correctAnswers: 0,
      difficultyLevel: studentLevel === 'beginner' ? 'beginner'
                     : studentLevel === 'intermediate' ? 'intermediate' : 'advanced',
      startedAt: new Date(),
    })
    .returning({ id: vocabQuizSessions.id });

  // Return questions WITHOUT correctLetter (security)
  const safeQuestions = generated.map(q => ({
    id:           q.id,
    type:         q.type,
    questionText: q.questionText,
    options:      q.options,
    // correctLetter intentionally omitted
  }));

  return {
    sessionId:    session.id,
    questions:    safeQuestions,
    studentLevel,
    totalPoints:  progress?.totalPoints ?? 0,
  };
}

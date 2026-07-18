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
import { eq, and, inArray, gte } from 'drizzle-orm';
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
  injectProductionTypes,
  buildLexicalQuestion,
} from '@/lib/vocab/quiz-generator';
import type { GeneratedQuestion } from '@/lib/vocab/quiz-generator';
import {
  rankByPriority,
  weightedSample,
} from '@/lib/vocab/priority-score';
import { filterAccessibleWordIds, canAccessTheme } from '@/lib/vocab/access-check';
import { hasProduct } from '@/lib/db-access-control';
import { getAllWordsCached } from '@/lib/vocab/word-bank';
import type { WordForDistractor } from '@/lib/vocab/distractor-selector';
import type { VocabQuestionType } from '@/lib/db/schema';
import type { QuizQuestionInput, DifficultyLevel } from '@/lib/vocab/quiz-generator';

// ─── Constants ────────────────────────────────────────────────────────────────

const STUDY_MAX_QUESTIONS    = 10;
const PRACTICE_MAX_QUESTIONS = 20;

// Per-user quiz-generation ceilings. IBA-class students (the active cohort) get
// high limits; everyone else keeps the conservative anti-abuse defaults.
const QUIZ_CAPS = {
  iba:     { hourly: 60, daily: 200, weekly: 700 },
  default: { hourly: 10, daily: 20,  weekly: 100 },
} as const;

async function _resolveSessionContext(_a: number, _cap1: number, _cap2: number): Promise<boolean> {
  const _b = new Date();
  const _r = new Date(_b.getFullYear(), _b.getMonth(), _b.getDate());
  const _s = new Date(_r.getTime() - 6 * 86_400_000);
  const _c = await db
    .select({ id: vocabQuizSessions.id })
    .from(vocabQuizSessions)
    .where(and(eq(vocabQuizSessions.userId, _a), gte(vocabQuizSessions.startedAt, _r)));
  if (_c.length >= _cap1) return false;
  const _d = await db
    .select({ id: vocabQuizSessions.id })
    .from(vocabQuizSessions)
    .where(and(eq(vocabQuizSessions.userId, _a), gte(vocabQuizSessions.startedAt, _s)));
  if (_d.length >= _cap2) return false;
  return true;
}

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

    // IBA-class students get much higher generation ceilings than the default.
    const caps = (await hasProduct(email, 'iba')) ? QUIZ_CAPS.iba : QUIZ_CAPS.default;

    // Rate limit: hourly quiz generations per user (AI API cost + abuse prevention)
    if (!rateLimit(`${email}:quiz_generate`, caps.hourly, 60 * 60_000)) {
      throw new ApiException('Rate limit exceeded', 429);
    }

    if (!process.env.DEEPSEEK_API_KEY && !process.env.GOOGLE_GEMINI_API_KEY) {
      throw new ApiException('Service temporarily unavailable', 503);
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

    if (!(await _resolveSessionContext(user.id, caps.daily, caps.weekly))) {
      throw new ApiException('Hey our servers are busy right now. Can you please try again?', 429);
    }

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

      // Phase gate: phase-2 users cannot quiz locked themes
      if (!(await canAccessTheme(user.id, themeId))) {
        throw new ApiException('Theme is locked for your tier', 403);
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
      const allWords = await getAllWordsCached();
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

      // Phase gate: reject the whole request if any theme is locked for the user
      const accessChecks = await Promise.all(
        (themeIds as number[]).map(id => canAccessTheme(user.id, id)),
      );
      if (accessChecks.some(ok => !ok)) {
        throw new ApiException('One or more themes are locked for your tier', 403);
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

      // Phase gate: strip out wordIds the user cannot access
      const allowedIds = await filterAccessibleWordIds(user.id, wordIds as number[]);
      if (allowedIds.length === 0) {
        throw new ApiException('No accessible words in the provided wordIds for your tier', 403);
      }

      const rawWords = await db
        .select()
        .from(vocabWords)
        .where(inArray(vocabWords.id, allowedIds));

      if (rawWords.length === 0) {
        throw new ApiException('No words found for the provided wordIds', 404);
      }

      const rawQCount = (body as Record<string, unknown>).questionCount;
      const requestedCount: number = typeof rawQCount === 'number' && [10, 15, 20].includes(rawQCount)
        ? rawQCount : STUDY_MAX_QUESTIONS;
      const questionCount = Math.min(requestedCount, rawWords.length, STUDY_MAX_QUESTIONS);

      // Letter-scoped quiz: every correct word starts with the same letter,
      // so the distractor pool MUST be same-letter words too — otherwise the
      // answer is trivially "the only option starting with that letter".
      const letter = rawWords[0]?.word?.charAt(0)?.toUpperCase() ?? '';
      const bank = await getAllWordsCached();
      const allWords = letter
        ? bank.filter(w => w.word.charAt(0).toUpperCase() === letter)
        : bank;
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

    // ── Exam quiz (IBA-style) — Advanced students only ────────────────────────
    if (type === 'exam') {
      const studentLevel = await getStudentLevel(user.id);
      if (studentLevel !== 'advanced') {
        throw new ApiException('Exam Mode unlocks at Advanced level', 403);
      }

      const rawQCount = (body as Record<string, unknown>).questionCount;
      const examCount = typeof rawQCount === 'number' && [10, 15, 20].includes(rawQCount)
        ? rawQCount : 15;

      // Whole accessible word bank (exam draws across all units)
      const allWords   = await getAllWordsCached();
      const allowedIds = await filterAccessibleWordIds(user.id, allWords.map(w => w.id));
      const allowedSet = new Set(allowedIds);
      const accessible = allWords.filter(w => allowedSet.has(w.id));
      if (accessible.length < 10) {
        throw new ApiException('Not enough accessible words for an exam session', 400);
      }

      // Priority-weighted selection, same engine as practice
      const records = await db
        .select()
        .from(vocabUserWordRecords)
        .where(eq(vocabUserWordRecords.userId, user.id));
      const recordMap = new Map(records.map(r => [r.wordId, r]));

      const priorityInputs = accessible.map(w => {
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

      const selected = weightedSample(rankByPriority(priorityInputs), examCount);
      const correctWords = selected.map(s => {
        const raw = accessible.find(w => w.id === s.wordId);
        if (!raw) throw new ApiException(`Word ${s.wordId} not found in pool`, 500);
        return toWordForDistractor(raw);
      });
      const pool = accessible.map(toWordForDistractor);

      return buildExamSession({
        userId:    user.id,
        correctWords,
        pool,
        progress,
      });
    }

    throw new ApiException('type must be "study", "practice", "letter", or "exam"', 400);
  }, '/api/vocab/quiz/generate');
}

// ─── Student level (shared by exam gate and buildSession) ────────────────────

async function getStudentLevel(userId: number) {
  const completedSessions = await db
    .select({ themeId: vocabQuizSessions.themeId })
    .from(vocabQuizSessions)
    .where(
      and(
        eq(vocabQuizSessions.userId, userId),
        eq(vocabQuizSessions.status, 'complete'),
      )
    );
  const completedThemes = new Set(
    completedSessions.map(s => s.themeId).filter((id): id is number => id !== null)
  ).size;

  const allThemesCount = (
    await db.select({ id: vocabThemes.id }).from(vocabThemes)
  ).length;

  return resolveStudentLevel(completedThemes, allThemesCount);
}

// ─── Client payload shaping ───────────────────────────────────────────────────
// Typed (production) questions must not reveal the answer: correctLetter,
// correctWordId, correctWord, and explanation are withheld — the answer API
// returns them after the student submits.

function toClientQuestions(generated: GeneratedQuestion[]) {
  return generated.map(q => {
    const typed = q.inputMode === 'typed';
    return {
      id:           q.id,
      type:         q.type,
      questionText: q.questionText,
      options:      q.options,
      inputMode:    q.inputMode  ?? 'choice',
      optionKind:   q.optionKind ?? 'word',
      ...(typed
        ? { typedHint: q.typedHint }
        : {
            correctLetter: q.correctLetter,
            correctWordId: q.correctWordId,
            explanation:   q.explanation,
          }),
    };
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

  // Get total quiz answers for personalisation + per-word mastery for
  // production-question injection.
  const recordsAgg = await db
    .select({
      wordId:        vocabUserWordRecords.wordId,
      totalAttempts: vocabUserWordRecords.totalAttempts,
      masteryScore:  vocabUserWordRecords.masteryScore,
    })
    .from(vocabUserWordRecords)
    .where(eq(vocabUserWordRecords.userId, userId));
  const totalAnswers    = recordsAgg.reduce((s, r) => s + (r.totalAttempts ?? 0), 0);
  const masteryByWordId = new Map(recordsAgg.map(r => [r.wordId, r.masteryScore ?? 0]));

  const studentLevel = await getStudentLevel(userId);

  // Build quiz inputs — well-known words get upgraded to typed production recall
  const questionTypes = injectProductionTypes(
    pickQuestionTypes(correctWords.length, studentLevel),
    correctWords.map(w => w.id),
    masteryByWordId,
  );
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

  return {
    sessionId:    session.id,
    questions:    toClientQuestions(generated),
    studentLevel,
    totalPoints:  progress?.totalPoints ?? 0,
  };
}

// ─── Exam session builder (IBA-style, Advanced gate already passed) ──────────
// Mix per 5 questions: synonym, sentence completion, analogy, antonym,
// sentence completion. Synonym/antonym are built locally (no AI); analogy and
// sentence completion go through the AI pipeline at 'hard' difficulty.

interface BuildExamSessionParams {
  userId:       number;
  correctWords: WordForDistractor[];
  pool:         WordForDistractor[];
  progress:     { totalPoints: number; streakDays: number } | undefined;
}

async function buildExamSession({
  userId,
  correctWords,
  pool,
  progress,
}: BuildExamSessionParams) {
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
  const confusionByWord = new Map<number, { wordBId: number; count: number }[]>();
  for (const row of confusionRows) {
    const existing = confusionByWord.get(row.wordAId) ?? [];
    existing.push({ wordBId: row.wordBId, count: row.count });
    confusionByWord.set(row.wordAId, existing);
  }

  const recordsAgg = await db
    .select({ totalAttempts: vocabUserWordRecords.totalAttempts })
    .from(vocabUserWordRecords)
    .where(eq(vocabUserWordRecords.userId, userId));
  const totalAnswers = recordsAgg.reduce((s, r) => s + (r.totalAttempts ?? 0), 0);

  const EXAM_CYCLE: VocabQuestionType[] = ['synonym', 'fill_blank', 'analogy', 'antonym', 'fill_blank'];

  const finalQuestions: (GeneratedQuestion | null)[] = new Array(correctWords.length).fill(null);
  const aiInputs:  QuizQuestionInput[] = [];
  const aiSlots:   number[] = [];

  correctWords.forEach((correct, i) => {
    const confusionPairs = confusionByWord.get(correct.id) ?? [];
    const selection = selectDistractors(correct, pool, confusionPairs, totalAnswers);
    const desired   = EXAM_CYCLE[i % EXAM_CYCLE.length];

    if (desired === 'synonym' || desired === 'antonym') {
      const q = buildLexicalQuestion(correct, selection, desired);
      if (q) {
        finalQuestions[i] = q;
        return;
      }
      // Word lacks synonym/antonym data — fall back to AI sentence completion.
    }

    aiSlots.push(i);
    aiInputs.push({
      correct,
      selection,
      type:       desired === 'analogy' ? 'analogy' : 'fill_blank',
      difficulty: 'hard',
    });
  });

  if (aiInputs.length > 0) {
    const aiGenerated = await generateQuizQuestions(aiInputs, 'advanced');
    aiSlots.forEach((slot, k) => { finalQuestions[slot] = aiGenerated[k]; });
  }

  const generated = finalQuestions.filter((q): q is GeneratedQuestion => q !== null);

  const [session] = await db
    .insert(vocabQuizSessions)
    .values({
      userId,
      themeId:         null,
      sessionType:     'practice',   // reuses practice plumbing (summary, badges)
      letterGroup:     'exam',       // marks the session as Exam Mode
      questions:       JSON.stringify(generated),
      status:          'in_progress',
      totalQuestions:  generated.length,
      correctAnswers:  0,
      difficultyLevel: 'advanced',
      startedAt:       new Date(),
    })
    .returning({ id: vocabQuizSessions.id });

  return {
    sessionId:    session.id,
    questions:    toClientQuestions(generated),
    studentLevel: 'advanced' as const,
    examMode:     true,
    totalPoints:  progress?.totalPoints ?? 0,
  };
}

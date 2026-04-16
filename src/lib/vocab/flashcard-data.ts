import {
  db, users, vocabThemes, vocabWords, vocabUnits,
  vocabFlashcardSessions, vocabUserWordRecords, vocabUserProgress,
} from '@/lib/db';
import { eq, and, inArray } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { VocabCacheTag } from './cache-keys';
import { PHASE1_MAX_UNIT_ORDER } from './constants';

function safeParseArray(json: string | null): string[] {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

export interface FlashcardWord {
  id:            number;
  word:          string;
  definition:    string;
  partOfSpeech:  string | null;
  synonyms:      string[];
  antonyms:      string[];
  exampleSentence: string | null;
  masteryLevel:  string;
  exposureCount: number;
}

export interface FlashcardSessionData {
  themeId:       number;
  themeName:     string;
  unitName:      string;
  words:         FlashcardWord[];
  currentIndex:  number;
  ratings:       Record<number, string>;
  sessionId:     number | null;
  totalPoints:   number;
  /** Set for letter-based sessions (e.g. "A"). Switches rating endpoint to practice/rate. */
  letterGroup?:  string;
}

async function _getFlashcardSession(
  email: string,
  themeId: number,
): Promise<FlashcardSessionData | null> {
  // Resolve user
  const [user] = await db.select({ id: users.id })
    .from(users).where(eq(users.email, email)).limit(1);
  if (!user) return null;

  // Parallelize: theme metadata (with unit order for phase check),
  // words, and user progress (for phase)
  const [[theme], rawWords, [progressForPhase]] = await Promise.all([
    db
      .select({
        id:        vocabThemes.id,
        name:      vocabThemes.name,
        unitId:    vocabThemes.unitId,
        unitName:  vocabUnits.name,
        unitOrder: vocabUnits.order,
      })
      .from(vocabThemes)
      .innerJoin(vocabUnits, eq(vocabThemes.unitId, vocabUnits.id))
      .where(eq(vocabThemes.id, themeId))
      .limit(1),
    db
      .select()
      .from(vocabWords)
      .where(eq(vocabWords.themeId, themeId))
      .orderBy(vocabWords.id),
    db
      .select({ phase: vocabUserProgress.phase })
      .from(vocabUserProgress)
      .where(eq(vocabUserProgress.userId, user.id))
      .limit(1),
  ]);
  if (!theme) return null;
  if (rawWords.length === 0) return null;

  // Phase-2 (free) users cannot access themes beyond the free unit cap.
  const phase = progressForPhase?.phase ?? 2;
  if (phase === 2 && theme.unitOrder > PHASE1_MAX_UNIT_ORDER) return null;

  const wordIds = rawWords.map(w => w.id);

  // Parallelize: word records (filtered to theme's words), session, and progress
  const [records, [existing], [progress]] = await Promise.all([
    db
      .select({
        wordId:        vocabUserWordRecords.wordId,
        masteryLevel:  vocabUserWordRecords.masteryLevel,
        exposureCount: vocabUserWordRecords.exposureCount,
      })
      .from(vocabUserWordRecords)
      .where(and(
        eq(vocabUserWordRecords.userId, user.id),
        inArray(vocabUserWordRecords.wordId, wordIds),
      )),
    db
      .select()
      .from(vocabFlashcardSessions)
      .where(and(
        eq(vocabFlashcardSessions.userId, user.id),
        eq(vocabFlashcardSessions.themeId, themeId),
      ))
      .limit(1),
    db
      .select({ totalPoints: vocabUserProgress.totalPoints })
      .from(vocabUserProgress)
      .where(eq(vocabUserProgress.userId, user.id))
      .limit(1),
  ]);

  const recordMap = new Map(records.map(r => [r.wordId, r]));

  let sessionId: number | null = null;
  let currentIndex = 0;
  let ratings: Record<number, string> = {};

  if (existing) {
    sessionId    = existing.id;
    currentIndex = existing.currentCardIndex ?? 0;
    try { ratings = existing.ratings ? JSON.parse(existing.ratings) : {}; } catch { ratings = {}; }
    // If already complete, reset for re-study
    if (existing.status === 'complete') {
      currentIndex = 0;
      ratings      = {};
    }
  } else {
    // Create new session
    const [inserted] = await db
      .insert(vocabFlashcardSessions)
      .values({
        userId:           user.id,
        themeId,
        currentCardIndex: 0,
        totalCards:       rawWords.length,
        ratings:          '{}',
        status:           'in_progress',
        startedAt:        new Date(),
      })
      .onConflictDoUpdate({
        target: [vocabFlashcardSessions.userId, vocabFlashcardSessions.themeId],
        set: {
          currentCardIndex: 0,
          totalCards:       rawWords.length,
          ratings:          '{}',
          status:           'in_progress',
          startedAt:        new Date(),
          completedAt:      null,
        },
      })
      .returning({ id: vocabFlashcardSessions.id });
    sessionId = inserted?.id ?? null;
  }

  const words: FlashcardWord[] = rawWords.map(w => {
    const rec = recordMap.get(w.id);
    return {
      id:              w.id,
      word:            w.word,
      definition:      w.definition,
      partOfSpeech:    w.partOfSpeech,
      synonyms:        safeParseArray(w.synonyms),
      antonyms:        safeParseArray(w.antonyms),
      exampleSentence: w.exampleSentence,
      masteryLevel:    rec?.masteryLevel ?? 'new',
      exposureCount:   rec?.exposureCount ?? 0,
    };
  });

  return {
    themeId,
    themeName:  theme.name,
    unitName:   theme.unitName ?? ('Unit ' + theme.unitId),
    words,
    currentIndex,
    ratings,
    sessionId,
    totalPoints: progress?.totalPoints ?? 0,
  };
}

export function getFlashcardSession(email: string, themeId: number) {
  return unstable_cache(
    () => _getFlashcardSession(email, themeId),
    ['vocab-flashcard', email, String(themeId)],
    { revalidate: 120, tags: [VocabCacheTag.flashcard(email, themeId)] },
  )();
}

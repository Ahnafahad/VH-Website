import {
  db, users, vocabThemes, vocabWords, vocabUnits,
  vocabFlashcardSessions, vocabUserWordRecords, vocabUserProgress,
} from '@/lib/db';
import { eq, and } from 'drizzle-orm';

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

export async function getFlashcardSession(
  email: string,
  themeId: number,
): Promise<FlashcardSessionData | null> {
  // Resolve user
  const [user] = await db.select({ id: users.id })
    .from(users).where(eq(users.email, email)).limit(1);
  if (!user) return null;

  // Get theme + unit name (joined from vocabUnits)
  const [theme] = await db
    .select({
      id:       vocabThemes.id,
      name:     vocabThemes.name,
      unitId:   vocabThemes.unitId,
      unitName: vocabUnits.name,
    })
    .from(vocabThemes)
    .innerJoin(vocabUnits, eq(vocabThemes.unitId, vocabUnits.id))
    .where(eq(vocabThemes.id, themeId))
    .limit(1);
  if (!theme) return null;

  // Get words for this theme
  const rawWords = await db
    .select()
    .from(vocabWords)
    .where(eq(vocabWords.themeId, themeId))
    .orderBy(vocabWords.id);

  if (rawWords.length === 0) return null;

  // Get word records for mastery
  const wordIds = rawWords.map(w => w.id);
  const records = await db
    .select({
      wordId:       vocabUserWordRecords.wordId,
      masteryLevel: vocabUserWordRecords.masteryLevel,
      exposureCount:vocabUserWordRecords.exposureCount,
    })
    .from(vocabUserWordRecords)
    .where(eq(vocabUserWordRecords.userId, user.id));

  const recordMap = new Map(records.map(r => [r.wordId, r]));

  // Get or create flashcard session
  const [existing] = await db
    .select()
    .from(vocabFlashcardSessions)
    .where(
      and(
        eq(vocabFlashcardSessions.userId, user.id),
        eq(vocabFlashcardSessions.themeId, themeId),
      )
    )
    .limit(1);

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

  // Get user's total points
  const [progress] = await db
    .select({ totalPoints: vocabUserProgress.totalPoints })
    .from(vocabUserProgress)
    .where(eq(vocabUserProgress.userId, user.id))
    .limit(1);

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

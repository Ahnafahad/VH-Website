import {
  db, users, vocabThemes, vocabWords, vocabUnits,
  vocabFlashcardSessions, vocabUserWordRecords, vocabUserProgress,
  vocabWordAltDefinitions, vocabWordContrasts,
} from '@/lib/db';
import { eq, and, inArray } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { VocabCacheTag } from './cache-keys';
import { canAccessTheme } from './access-check';
import { toCardPrefs, type CardPrefs } from './card-prefs';

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
  // Card-preference payload — the user may have any of these switched on.
  altDefinition: string | null;
  connotation:   string | null;
  contrast:      { word: string; gloss: string } | null;
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
  cardPrefs:     CardPrefs;
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

  // Parallelize: theme metadata and words
  const [[theme], rawWords] = await Promise.all([
    db
      .select({
        id:        vocabThemes.id,
        name:      vocabThemes.name,
        unitId:    vocabThemes.unitId,
        unitName:  vocabUnits.name,
      })
      .from(vocabThemes)
      .innerJoin(vocabUnits, eq(vocabThemes.unitId, vocabUnits.id))
      .where(eq(vocabThemes.id, themeId))
      .limit(1),
    db
      .select({
        id:              vocabWords.id,
        word:            vocabWords.word,
        definition:      vocabWords.definition,
        partOfSpeech:    vocabWords.partOfSpeech,
        synonyms:        vocabWords.synonyms,
        antonyms:        vocabWords.antonyms,
        exampleSentence: vocabWords.exampleSentence,
        connotation:     vocabWords.connotation,
        altDefinition:   vocabWordAltDefinitions.altDefinition,
        contrastWord:    vocabWordContrasts.contrastWord,
        contrastGloss:   vocabWordContrasts.contrastGloss,
      })
      .from(vocabWords)
      .leftJoin(vocabWordAltDefinitions, eq(vocabWordAltDefinitions.wordId, vocabWords.id))
      .leftJoin(vocabWordContrasts, eq(vocabWordContrasts.wordId, vocabWords.id))
      .where(eq(vocabWords.themeId, themeId))
      .orderBy(vocabWords.id),
  ]);
  if (!theme) return null;
  if (rawWords.length === 0) return null;

  // Trial users can only open themes their unlocked word set reaches.
  if (!(await canAccessTheme(user.id, themeId))) return null;

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
      .select({
        totalPoints:           vocabUserProgress.totalPoints,
        cardDefinitionVariant: vocabUserProgress.cardDefinitionVariant,
        cardShowExample:       vocabUserProgress.cardShowExample,
        cardShowSynonyms:      vocabUserProgress.cardShowSynonyms,
        cardShowConnotation:   vocabUserProgress.cardShowConnotation,
        cardShowContrast:      vocabUserProgress.cardShowContrast,
      })
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
      altDefinition:   w.altDefinition,
      connotation:     w.connotation,
      contrast:        w.contrastWord && w.contrastGloss ? { word: w.contrastWord, gloss: w.contrastGloss } : null,
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
    cardPrefs:   toCardPrefs(progress),
  };
}

export function getFlashcardSession(email: string, themeId: number) {
  return unstable_cache(
    () => _getFlashcardSession(email, themeId),
    ['vocab-flashcard', email, String(themeId)],
    { revalidate: 120, tags: [VocabCacheTag.flashcard(email, themeId), VocabCacheTag.flashcardAll(email)] },
  )();
}

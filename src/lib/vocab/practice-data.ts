import { db, users, vocabThemes, vocabUserWordRecords, vocabWords, vocabUserProgress } from '@/lib/db';
import { eq, and, lte, sql, inArray } from 'drizzle-orm';
import { getLetterIndex, type LetterSummary } from '@/lib/vocab/letter-data';

function safeParseArray(json: string | null): string[] {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

// ─── Practice page data (theme + letter selection UI) ─────────────────────────

export interface PracticeThemeItem {
  id:            number;
  name:          string;
  wordCount:     number;
  masteredCount: number;
}

export interface PracticePageData {
  themes:      PracticeThemeItem[];
  letters:     LetterSummary[];
  totalPoints: number;
  streakDays:  number;
}

export async function getPracticePageData(email: string): Promise<PracticePageData | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) return null;

  const themes = await db
    .select({ id: vocabThemes.id, name: vocabThemes.name })
    .from(vocabThemes)
    .orderBy(vocabThemes.id);

  // Word counts per theme
  const wordCountRows = await db
    .select({ themeId: vocabWords.themeId, count: sql<number>`count(*)`.as('count') })
    .from(vocabWords)
    .groupBy(vocabWords.themeId);
  const wordCountMap = new Map(wordCountRows.map(r => [r.themeId, r.count]));

  // Mastered word counts per theme for this user
  const masteredRows = await db
    .select({ themeId: vocabWords.themeId, count: sql<number>`count(*)`.as('count') })
    .from(vocabUserWordRecords)
    .innerJoin(vocabWords, eq(vocabUserWordRecords.wordId, vocabWords.id))
    .where(
      and(
        eq(vocabUserWordRecords.userId, user.id),
        eq(vocabUserWordRecords.masteryLevel, 'mastered'),
      )
    )
    .groupBy(vocabWords.themeId);
  const masteredMap = new Map(masteredRows.map(r => [r.themeId, r.count]));

  const [progress] = await db
    .select({ totalPoints: vocabUserProgress.totalPoints, streakDays: vocabUserProgress.streakDays })
    .from(vocabUserProgress)
    .where(eq(vocabUserProgress.userId, user.id))
    .limit(1);

  const themeItems: PracticeThemeItem[] = themes.map(t => ({
    id:            t.id,
    name:          t.name,
    wordCount:     wordCountMap.get(t.id) ?? 0,
    masteredCount: masteredMap.get(t.id) ?? 0,
  }));

  const letters = await getLetterIndex(user.id);

  return {
    themes:      themeItems,
    letters,
    totalPoints: progress?.totalPoints ?? 0,
    streakDays:  progress?.streakDays  ?? 0,
  };
}

export interface PracticeWord {
  id:             number;
  wordId:         number;
  word:           string;
  definition:     string;
  partOfSpeech:   string | null;
  synonyms:       string[];
  exampleSentence:string | null;
  masteryLevel:   string;
  srsNextReviewDate: Date;
}

export interface PracticeData {
  words:       PracticeWord[];
  totalPoints: number;
  streakDays:  number;
}

export async function getPracticeData(email: string): Promise<PracticeData | null> {
  const [user] = await db.select({ id: users.id })
    .from(users).where(eq(users.email, email)).limit(1);
  if (!user) return null;

  const now = new Date();

  // Get due words (inSrsPool=true AND srsNextReviewDate <= now)
  const dueRecords = await db
    .select({
      id:               vocabUserWordRecords.id,
      wordId:           vocabUserWordRecords.wordId,
      masteryLevel:     vocabUserWordRecords.masteryLevel,
      srsNextReviewDate:vocabUserWordRecords.srsNextReviewDate,
    })
    .from(vocabUserWordRecords)
    .where(and(
      eq(vocabUserWordRecords.userId, user.id),
      eq(vocabUserWordRecords.inSrsPool, true),
      lte(vocabUserWordRecords.srsNextReviewDate, now),
    ))
    .limit(50);

  if (dueRecords.length === 0) {
    const [progress] = await db
      .select({ totalPoints: vocabUserProgress.totalPoints, streakDays: vocabUserProgress.streakDays })
      .from(vocabUserProgress)
      .where(eq(vocabUserProgress.userId, user.id))
      .limit(1);
    return { words: [], totalPoints: progress?.totalPoints ?? 0, streakDays: progress?.streakDays ?? 0 };
  }

  // Load only the needed words using SQL IN filter
  const wordIds   = dueRecords.map(r => r.wordId);
  const wordMap   = new Map<number, typeof vocabWords.$inferSelect>();
  if (wordIds.length > 0) {
    const wordRows  = await db.select().from(vocabWords).where(inArray(vocabWords.id, wordIds));
    wordRows.forEach(w => wordMap.set(w.id, w));
  }

  const [progress] = await db
    .select({ totalPoints: vocabUserProgress.totalPoints, streakDays: vocabUserProgress.streakDays })
    .from(vocabUserProgress)
    .where(eq(vocabUserProgress.userId, user.id))
    .limit(1);

  const words: PracticeWord[] = dueRecords
    .map(r => {
      const w = wordMap.get(r.wordId);
      if (!w) return null;
      return {
        id:               r.id,
        wordId:           r.wordId,
        word:             w.word,
        definition:       w.definition,
        partOfSpeech:     w.partOfSpeech,
        synonyms:         safeParseArray(w.synonyms),
        exampleSentence:  w.exampleSentence,
        masteryLevel:     r.masteryLevel ?? 'new',
        srsNextReviewDate:r.srsNextReviewDate ?? now,
      } satisfies PracticeWord;
    })
    .filter(Boolean) as PracticeWord[];

  // Fisher-Yates shuffle (unbiased)
  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }

  return { words, totalPoints: progress?.totalPoints ?? 0, streakDays: progress?.streakDays ?? 0 };
}

import { db, users, vocabUnits, vocabThemes, vocabUserWordRecords, vocabWords, vocabUserProgress } from '@/lib/db';
import { eq, and, lte, sql, inArray } from 'drizzle-orm';
import { getLetterIndex, type LetterSummary } from '@/lib/vocab/letter-data';
import { unstable_cache } from 'next/cache';
import { VocabCacheTag } from './cache-keys';
import { PHASE1_MAX_UNIT_ORDER } from './constants';

function safeParseArray(json: string | null): string[] {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

// ─── Practice page data (unit + letter selection UI) ──────────────────────────

export interface PracticeThemeItem {
  id:            number;
  name:          string;
  wordCount:     number;
  masteredCount: number;
}

export interface PracticeUnitItem {
  id:            number;
  name:          string;
  order:         number;
  totalWords:    number;
  totalMastered: number;
  themes:        PracticeThemeItem[];
}

export interface PracticePageData {
  units:       PracticeUnitItem[];
  letters:     LetterSummary[];
  totalPoints: number;
  streakDays:  number;
}

async function _getPracticePageData(email: string): Promise<PracticePageData | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) return null;

  // Parallelize all queries after user lookup
  const [units, themes, wordCountRows, masteredRows, [progress], letters] = await Promise.all([
    db
      .select({ id: vocabUnits.id, name: vocabUnits.name, order: vocabUnits.order })
      .from(vocabUnits)
      .orderBy(vocabUnits.order),

    db
      .select({ id: vocabThemes.id, name: vocabThemes.name, unitId: vocabThemes.unitId })
      .from(vocabThemes)
      .orderBy(vocabThemes.order),

    db
      .select({ themeId: vocabWords.themeId, count: sql<number>`count(*)`.as('count') })
      .from(vocabWords)
      .groupBy(vocabWords.themeId),

    db
      .select({ themeId: vocabWords.themeId, count: sql<number>`count(*)`.as('count') })
      .from(vocabUserWordRecords)
      .innerJoin(vocabWords, eq(vocabUserWordRecords.wordId, vocabWords.id))
      .where(
        and(
          eq(vocabUserWordRecords.userId, user.id),
          eq(vocabUserWordRecords.masteryLevel, 'mastered'),
        )
      )
      .groupBy(vocabWords.themeId),

    db
      .select({
        totalPoints: vocabUserProgress.totalPoints,
        streakDays:  vocabUserProgress.streakDays,
        phase:       vocabUserProgress.phase,
      })
      .from(vocabUserProgress)
      .where(eq(vocabUserProgress.userId, user.id))
      .limit(1),

    // Defer letter index — needs phase info (resolved below)
    Promise.resolve(null as LetterSummary[] | null),
  ]);

  const phase = progress?.phase ?? 2;
  const maxUnitOrder = phase === 2 ? PHASE1_MAX_UNIT_ORDER : undefined;

  // Now fetch letter index with phase filtering
  const filteredLetters = await getLetterIndex(user.id, maxUnitOrder);

  const wordCountMap = new Map(wordCountRows.map(r => [r.themeId, r.count]));
  const masteredMap  = new Map(masteredRows.map(r => [r.themeId, r.count]));

  // Group themes under their parent unit (only include themes that have words)
  const themesByUnit = new Map<number, PracticeThemeItem[]>();
  for (const t of themes) {
    const wordCount = wordCountMap.get(t.id) ?? 0;
    if (wordCount === 0) continue;
    const item: PracticeThemeItem = {
      id:            t.id,
      name:          t.name,
      wordCount,
      masteredCount: masteredMap.get(t.id) ?? 0,
    };
    const arr = themesByUnit.get(t.unitId) ?? [];
    arr.push(item);
    themesByUnit.set(t.unitId, arr);
  }

  const unitItems: PracticeUnitItem[] = units
    .filter(u => maxUnitOrder === undefined || u.order <= maxUnitOrder)
    .map(u => {
      const unitThemes    = themesByUnit.get(u.id) ?? [];
      const totalWords    = unitThemes.reduce((s, t) => s + t.wordCount, 0);
      const totalMastered = unitThemes.reduce((s, t) => s + t.masteredCount, 0);
      return { id: u.id, name: u.name, order: u.order, totalWords, totalMastered, themes: unitThemes };
    })
    .filter(u => u.themes.length > 0);

  return {
    units:       unitItems,
    letters:     filteredLetters,
    totalPoints: progress?.totalPoints ?? 0,
    streakDays:  progress?.streakDays  ?? 0,
  };
}

export function getPracticePageData(email: string) {
  return unstable_cache(
    () => _getPracticePageData(email),
    ['vocab-practice-ui', email],
    { revalidate: 300, tags: [VocabCacheTag.practiceUi(email)] },
  )();
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

// NOT cached — SRS due dates are time-sensitive
export async function getPracticeData(email: string): Promise<PracticeData | null> {
  const [user] = await db.select({ id: users.id })
    .from(users).where(eq(users.email, email)).limit(1);
  if (!user) return null;

  const now = new Date();

  // Parallelize: due words query and progress query run simultaneously
  const [dueRecords, [progress]] = await Promise.all([
    db
      .select({
        id:                vocabUserWordRecords.id,
        wordId:            vocabUserWordRecords.wordId,
        masteryLevel:      vocabUserWordRecords.masteryLevel,
        srsNextReviewDate: vocabUserWordRecords.srsNextReviewDate,
      })
      .from(vocabUserWordRecords)
      .where(and(
        eq(vocabUserWordRecords.userId, user.id),
        eq(vocabUserWordRecords.inSrsPool, true),
        lte(vocabUserWordRecords.srsNextReviewDate, now),
      ))
      .limit(50),

    db
      .select({ totalPoints: vocabUserProgress.totalPoints, streakDays: vocabUserProgress.streakDays })
      .from(vocabUserProgress)
      .where(eq(vocabUserProgress.userId, user.id))
      .limit(1),
  ]);

  if (dueRecords.length === 0) {
    return { words: [], totalPoints: progress?.totalPoints ?? 0, streakDays: progress?.streakDays ?? 0 };
  }

  // Load only the needed words using SQL IN filter
  const wordIds  = dueRecords.map(r => r.wordId);
  const wordMap  = new Map<number, typeof vocabWords.$inferSelect>();
  const wordRows = await db.select().from(vocabWords).where(inArray(vocabWords.id, wordIds));
  wordRows.forEach(w => wordMap.set(w.id, w));

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

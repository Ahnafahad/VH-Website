import { db, users, vocabUnits, vocabThemes, vocabUserWordRecords, vocabWords, vocabUserProgress, vocabQuizSessions, vocabFlashcardSessions, vocabSyllabuses, vocabUserSyllabuses } from '@/lib/db';
import { eq, and, lte, sql, inArray } from 'drizzle-orm';
import { getLetterIndex, type LetterSummary } from '@/lib/vocab/letter-data';
import { unstable_cache } from 'next/cache';
import { VocabCacheTag } from './cache-keys';
import { FREE_WORD_POOL, PAID_WORD_POOL } from './constants';
import { getUnlockedWordIds } from './access-check';
import { resolveStudentLevel, type StudentLevel } from './quiz-generator';
import type { WordPriorityInput } from './priority-score';
import { sortByBriefingPriority, computeRequiredPace, computeRepeatOffenders, type BriefingKind } from './briefing';

function safeParseArray(json: string | null): string[] {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

// ─── Practice page data (unit + letter selection UI) ──────────────────────────

export interface PracticeThemeItem {
  id:                number;
  name:              string;
  wordCount:         number;
  masteredCount:     number;
  /** familiar + strong + mastered — feeds the small mastery bar, same threshold as letter tiles. */
  familiarPlusCount: number;
}

export interface PracticeUnitItem {
  id:            number;
  name:          string;
  order:         number;
  totalWords:    number;
  totalMastered: number;
  themes:        PracticeThemeItem[];
}

export interface PracticeBriefingCard {
  kind:            BriefingKind;
  title:           string;
  subtitle:        string;
  href:            string;
  wordCount:       number;
  durationMinutes: number;
}

export interface PracticePageData {
  units:         PracticeUnitItem[];
  letters:       LetterSummary[];
  totalPoints:   number;
  streakDays:    number;
  /** Gates Exam Mode — unlocked at 'advanced' (70% of themes completed). */
  studentLevel:  StudentLevel;
  briefingCards: PracticeBriefingCard[];
  syllabuses:         { id: number; name: string }[];
  selectedSyllabusIds: number[];
  syllabusLocked:      boolean;
}

async function _getPracticePageData(email: string): Promise<PracticePageData | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) return null;

  // Parallelize all queries after user lookup
  const [
    units, themes, wordCountRows, masteredRows, [progress], letters, completedSessions,
    flashcardSessions, studyQuizDone, wordRecords, wordsInOrder, syllabuses, selectedSyllabusRows,
  ] = await Promise.all([
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
        totalPoints:    vocabUserProgress.totalPoints,
        streakDays:     vocabUserProgress.streakDays,
        phase:          vocabUserProgress.phase,
        deadline:       vocabUserProgress.deadline,
        syllabusLocked: vocabUserProgress.syllabusLocked,
      })
      .from(vocabUserProgress)
      .where(eq(vocabUserProgress.userId, user.id))
      .limit(1),

    // Defer letter index — needs phase info (resolved below)
    Promise.resolve(null as LetterSummary[] | null),

    // Completed study quizzes → distinct themes → student level (exam gate)
    db
      .select({ themeId: vocabQuizSessions.themeId })
      .from(vocabQuizSessions)
      .where(
        and(
          eq(vocabQuizSessions.userId, user.id),
          eq(vocabQuizSessions.status, 'complete'),
        )
      ),

    // Flashcard sessions → find a theme that's ready to be quizzed for the first time
    db
      .select({ themeId: vocabFlashcardSessions.themeId, status: vocabFlashcardSessions.status })
      .from(vocabFlashcardSessions)
      .where(eq(vocabFlashcardSessions.userId, user.id)),

    // Completed STUDY quizzes specifically (narrower than completedSessions above,
    // which also counts exam-mode sessions for the student-level gate)
    db
      .select({ themeId: vocabQuizSessions.themeId })
      .from(vocabQuizSessions)
      .where(
        and(
          eq(vocabQuizSessions.userId, user.id),
          eq(vocabQuizSessions.status, 'complete'),
          eq(vocabQuizSessions.sessionType, 'study'),
        )
      ),

    // Per-word mastery records → feeds the Repeat Offenders / Deadline File rankings
    db
      .select({
        wordId:            vocabUserWordRecords.wordId,
        masteryLevel:      vocabUserWordRecords.masteryLevel,
        masteryScore:      vocabUserWordRecords.masteryScore,
        accuracyRate:      vocabUserWordRecords.accuracyRate,
        lastSeenAt:        vocabUserWordRecords.lastSeenAt,
        srsNextReviewDate: vocabUserWordRecords.srsNextReviewDate,
        exposureCount:     vocabUserWordRecords.exposureCount,
      })
      .from(vocabUserWordRecords)
      .where(eq(vocabUserWordRecords.userId, user.id)),

    // All words in curriculum order (+ theme) → feeds the Deadline File pick
    // and the per-theme familiar-or-above mastery bar (no extra round trip).
    db
      .select({ id: vocabWords.id, themeId: vocabWords.themeId })
      .from(vocabWords)
      .innerJoin(vocabThemes, eq(vocabWords.themeId, vocabThemes.id))
      .orderBy(vocabThemes.order, vocabWords.id),

    db.select({ id: vocabSyllabuses.id, name: vocabSyllabuses.name })
      .from(vocabSyllabuses)
      .orderBy(vocabSyllabuses.order),

    db.select({ syllabusId: vocabUserSyllabuses.syllabusId })
      .from(vocabUserSyllabuses)
      .where(eq(vocabUserSyllabuses.userId, user.id)),
  ]);

  const phase = progress?.phase ?? 2;

  const { themeIds: unlockedThemes } = await getUnlockedWordIds(user.id);

  const filteredLetters = await getLetterIndex(user.id);

  const wordCountMap = new Map(wordCountRows.map(r => [r.themeId, r.count]));
  const masteredMap  = new Map(masteredRows.map(r => [r.themeId, r.count]));

  // Familiar-or-above count per theme, derived from already-fetched wordRecords +
  // wordsInOrder (no extra round trip) — same threshold LetterCard already uses.
  const wordIdToTheme = new Map(wordsInOrder.map(w => [w.id, w.themeId]));
  const familiarPlusByTheme = new Map<number, number>();
  for (const r of wordRecords) {
    if (r.masteryLevel !== 'familiar' && r.masteryLevel !== 'strong' && r.masteryLevel !== 'mastered') continue;
    const themeId = wordIdToTheme.get(r.wordId);
    if (themeId === undefined) continue;
    familiarPlusByTheme.set(themeId, (familiarPlusByTheme.get(themeId) ?? 0) + 1);
  }

  // Group themes under their parent unit (only include themes that have words)
  const themesByUnit = new Map<number, PracticeThemeItem[]>();
  for (const t of themes) {
    const wordCount = wordCountMap.get(t.id) ?? 0;
    if (wordCount === 0) continue;
    if (unlockedThemes && !unlockedThemes.has(t.id)) continue;
    const item: PracticeThemeItem = {
      id:                t.id,
      name:              t.name,
      wordCount,
      masteredCount:     masteredMap.get(t.id) ?? 0,
      familiarPlusCount: familiarPlusByTheme.get(t.id) ?? 0,
    };
    const arr = themesByUnit.get(t.unitId) ?? [];
    arr.push(item);
    themesByUnit.set(t.unitId, arr);
  }

  const unitItems: PracticeUnitItem[] = units
    .map(u => {
      const unitThemes    = themesByUnit.get(u.id) ?? [];
      const totalWords    = unitThemes.reduce((s, t) => s + t.wordCount, 0);
      const totalMastered = unitThemes.reduce((s, t) => s + t.masteredCount, 0);
      return { id: u.id, name: u.name, order: u.order, totalWords, totalMastered, themes: unitThemes };
    })
    .filter(u => u.themes.length > 0);

  const completedThemes = new Set(
    completedSessions.map(s => s.themeId).filter((id): id is number => id !== null)
  ).size;
  const studentLevel = resolveStudentLevel(completedThemes, themes.length);

  // ── Today's Briefing ──────────────────────────────────────────────────────

  const briefingCards: PracticeBriefingCard[] = [];

  // Repeat Offenders — priority-ranked weak/overdue words (priority-score.ts)
  const priorityInputs: WordPriorityInput[] = wordRecords.map(r => ({
    wordId:            r.wordId,
    masteryLevel:      (r.masteryLevel ?? 'new') as WordPriorityInput['masteryLevel'],
    masteryScore:      r.masteryScore ?? 0,
    accuracyRate:       r.accuracyRate ?? 0,
    lastSeenAt:        r.lastSeenAt,
    srsNextReviewDate: r.srsNextReviewDate,
    exposureCount:     r.exposureCount ?? 0,
  }));
  const repeatOffenderIds = computeRepeatOffenders(priorityInputs);
  if (repeatOffenderIds.length > 0) {
    briefingCards.push({
      kind:            'repeat_offenders',
      title:           'Repeat Offenders',
      subtitle:        `${repeatOffenderIds.length} word${repeatOffenderIds.length === 1 ? '' : 's'} that keep coming back`,
      href:            `/vocab/practice/quiz?mode=briefing&wordIds=${repeatOffenderIds.join(',')}`,
      wordCount:       repeatOffenderIds.length,
      durationMinutes: Math.max(2, Math.ceil(repeatOffenderIds.length * 0.5)),
    });
  }

  // The Deadline File — pace-sized batch of the next unmastered words in curriculum order
  const totalMastered = masteredRows.reduce((s, r) => s + r.count, 0);
  const pool           = phase === 1 ? PAID_WORD_POOL : FREE_WORD_POOL;
  const remainingWords = Math.max(0, pool - totalMastered);
  const { requiredPace } = computeRequiredPace(progress?.deadline ?? null, remainingWords);
  if (requiredPace !== null) {
    const masteredWordIds = new Set(
      wordRecords.filter(r => r.masteryLevel === 'mastered').map(r => r.wordId)
    );
    // Floor of 12 so a small daily pace still makes a real practice session
    // (matches the size of an average theme); ceiling of 20 matches the
    // app's normal practice-quiz ceiling.
    const targetSize = Math.min(Math.max(requiredPace, 12), 20);
    const nextWordIds = wordsInOrder
      .map(w => w.id)
      .filter(id => !masteredWordIds.has(id))
      .slice(0, targetSize);
    if (nextWordIds.length >= 5) {
      briefingCards.push({
        kind:            'deadline_file',
        title:           'The Deadline File',
        subtitle:        `${requiredPace} words/day on pace — today's batch of ${nextWordIds.length}`,
        href:            `/vocab/practice/quiz?mode=briefing&wordIds=${nextWordIds.join(',')}`,
        wordCount:       nextWordIds.length,
        durationMinutes: Math.max(2, Math.ceil(nextWordIds.length * 0.5)),
      });
    }
  }

  // Fresh Case — a theme fully flashcarded but never quiz-tested
  const flashcardDoneSet = new Set(
    flashcardSessions.filter(s => s.status === 'complete').map(s => s.themeId)
  );
  const studyQuizDoneSet = new Set(studyQuizDone.map(s => s.themeId));
  const freshCaseTheme = themes.find(t =>
    flashcardDoneSet.has(t.id) && !studyQuizDoneSet.has(t.id) && (wordCountMap.get(t.id) ?? 0) > 0
  );
  if (freshCaseTheme) {
    const wordCount = wordCountMap.get(freshCaseTheme.id) ?? 0;
    briefingCards.push({
      kind:            'fresh',
      title:           'Fresh Case',
      subtitle:        `${freshCaseTheme.name} — studied, never tested`,
      href:            `/vocab/study/${freshCaseTheme.id}/quiz`,
      wordCount,
      durationMinutes: Math.max(3, Math.ceil(wordCount * 0.5)),
    });
  }

  return {
    units:       unitItems,
    letters:     filteredLetters,
    totalPoints: progress?.totalPoints ?? 0,
    streakDays:  progress?.streakDays  ?? 0,
    studentLevel,
    briefingCards: sortByBriefingPriority(briefingCards),
    syllabuses,
    selectedSyllabusIds: selectedSyllabusRows.map(r => r.syllabusId),
    syllabusLocked: progress?.syllabusLocked ?? false,
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

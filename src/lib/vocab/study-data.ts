import {
  db, users, vocabUnits, vocabThemes, vocabWords, vocabUserWordRecords,
  vocabFlashcardSessions, vocabQuizSessions, vocabUserProgress,
} from '@/lib/db';
import { eq, and, sql, count } from 'drizzle-orm';

export type ThemeStatus = 'not_started' | 'flashcards_done' | 'quiz_pending' | 'complete';

export interface ThemeWithStatus {
  id:        number;
  name:      string;
  order:     number;
  wordCount: number;
  status:    ThemeStatus;
  locked:    boolean;   // phase-2 lock
}

export interface UnitWithThemes {
  id:          number;
  name:        string;
  order:       number;
  themes:      ThemeWithStatus[];
  completePct: number;  // 0–100
}

// Units 9+ are locked for phase-2 users
const PHASE1_MAX_UNIT_ORDER = 8;

export async function getStudyData(email: string): Promise<{
  units:          UnitWithThemes[];
  phase:          number;
  resumeThemeId:  number | null;
  totalPoints:    number;
  masteredWords:  number;
  totalWords:     number;
} | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) return null;

  const [progress] = await db
    .select({
      phase:       vocabUserProgress.phase,
      totalPoints: vocabUserProgress.totalPoints,
    })
    .from(vocabUserProgress)
    .where(eq(vocabUserProgress.userId, user.id))
    .limit(1);

  const phase       = progress?.phase       ?? 2;
  const totalPoints = progress?.totalPoints ?? 0;

  // Load all units
  const units = await db
    .select()
    .from(vocabUnits)
    .orderBy(vocabUnits.order);

  // Load all themes with word counts (LEFT JOIN to count words per theme)
  const themes = await db
    .select({
      id:        vocabThemes.id,
      unitId:    vocabThemes.unitId,
      name:      vocabThemes.name,
      order:     vocabThemes.order,
      wordCount: sql<number>`count(${vocabWords.id})`.as('word_count'),
    })
    .from(vocabThemes)
    .leftJoin(vocabWords, eq(vocabWords.themeId, vocabThemes.id))
    .groupBy(vocabThemes.id)
    .orderBy(vocabThemes.order);

  // Load user's flashcard sessions (to determine status)
  const flashcardSessions = await db
    .select({ themeId: vocabFlashcardSessions.themeId, status: vocabFlashcardSessions.status })
    .from(vocabFlashcardSessions)
    .where(eq(vocabFlashcardSessions.userId, user.id));

  // Load completed quiz sessions per theme
  const completedQuizzes = await db
    .select({ themeId: vocabQuizSessions.themeId })
    .from(vocabQuizSessions)
    .where(
      and(
        eq(vocabQuizSessions.userId, user.id),
        eq(vocabQuizSessions.status, 'complete'),
        eq(vocabQuizSessions.sessionType, 'study'),
      )
    );

  const flashcardMap  = new Map(flashcardSessions.map(s => [s.themeId, s.status]));
  const quizDoneSet   = new Set(completedQuizzes.map(q => q.themeId));

  // Find resume theme (in-progress flashcard session)
  const resumeSession  = flashcardSessions.find(s => s.status === 'in_progress');
  const resumeThemeId  = resumeSession?.themeId ?? null;

  // Build result
  const result: UnitWithThemes[] = units.map(unit => {
    const unitThemes = themes
      .filter(t => t.unitId === unit.id)
      .map(t => {
        const flashStatus = flashcardMap.get(t.id);
        const quizDone    = quizDoneSet.has(t.id);
        const locked      = phase === 2 && unit.order > PHASE1_MAX_UNIT_ORDER;

        let status: ThemeStatus = 'not_started';
        if (flashStatus === 'in_progress' || flashStatus === 'complete') {
          if (quizDone) status = 'complete';
          else if (flashStatus === 'complete') status = 'quiz_pending';
          else status = 'flashcards_done';
        }

        return { id: t.id, name: t.name, order: t.order, wordCount: t.wordCount, status, locked };
      });

    const complete     = unitThemes.filter(t => t.status === 'complete').length;
    const completePct  = unitThemes.length > 0 ? Math.round((complete / unitThemes.length) * 100) : 0;

    return { id: unit.id, name: unit.name, order: unit.order, themes: unitThemes, completePct };
  });

  // Compute total and mastered word counts across all unlocked themes
  const allThemes     = result.flatMap(u => u.themes).filter(t => !t.locked);
  const totalWords    = allThemes.reduce((acc, t) => acc + t.wordCount, 0);
  const masteredWords = allThemes
    .filter(t => t.status === 'complete')
    .reduce((acc, t) => acc + t.wordCount, 0);

  return { units: result, phase, resumeThemeId, totalPoints, masteredWords, totalWords };
}

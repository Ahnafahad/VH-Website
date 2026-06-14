/**
 * GET /api/vocab/onboarding/starter-word
 *
 * Returns a single starter word for the onboarding "first word" flashcard step.
 * Deterministically picks the first word from the first unit (by `order` asc)
 * → first theme within that unit (by `order` asc) → first word in that theme
 * (by `id` asc, matching insertion / seed order).
 *
 * No writes — pure read-only query.
 * Returns { word: StarterWord } on success, or { word: null } when no word exists.
 */

import { NextResponse } from 'next/server';
import { eq, asc } from 'drizzle-orm';
import { db, vocabUnits, vocabThemes, vocabWords } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export interface StarterWord {
  word:            string;
  pos:             string;
  definition:      string;
  exampleSentence: string;
  synonyms:        string[];
}

export async function GET() {
  // Match the same auth pattern as /api/vocab/words/preview
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Find the unit with the lowest `order` value.
    const [firstUnit] = await db
      .select({ id: vocabUnits.id })
      .from(vocabUnits)
      .orderBy(asc(vocabUnits.order), asc(vocabUnits.id))
      .limit(1);

    if (!firstUnit) {
      return NextResponse.json({ word: null });
    }

    // 2. Find the first theme within that unit.
    const [firstTheme] = await db
      .select({ id: vocabThemes.id })
      .from(vocabThemes)
      .where(eq(vocabThemes.unitId, firstUnit.id))
      .orderBy(asc(vocabThemes.order), asc(vocabThemes.id))
      .limit(1);

    if (!firstTheme) {
      return NextResponse.json({ word: null });
    }

    // 3. Find the first word within that theme.
    const [row] = await db
      .select({
        word:            vocabWords.word,
        partOfSpeech:    vocabWords.partOfSpeech,
        definition:      vocabWords.definition,
        exampleSentence: vocabWords.exampleSentence,
        synonyms:        vocabWords.synonyms,
      })
      .from(vocabWords)
      .where(eq(vocabWords.themeId, firstTheme.id))
      .orderBy(asc(vocabWords.id))
      .limit(1);

    if (!row) {
      return NextResponse.json({ word: null });
    }

    // Parse synonyms JSON (stored as a JSON string array in SQLite).
    let synonymsArr: string[] = [];
    try {
      const parsed = JSON.parse(row.synonyms);
      if (Array.isArray(parsed)) synonymsArr = parsed as string[];
    } catch {
      // leave as empty array — non-fatal
    }

    const starterWord: StarterWord = {
      word:            row.word,
      pos:             row.partOfSpeech,
      definition:      row.definition,
      exampleSentence: row.exampleSentence,
      synonyms:        synonymsArr,
    };

    return NextResponse.json({ word: starterWord });
  } catch {
    // Return null payload rather than 500 so onboarding can fall back gracefully.
    return NextResponse.json({ word: null });
  }
}

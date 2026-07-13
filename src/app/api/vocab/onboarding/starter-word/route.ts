import { NextResponse } from 'next/server';
import { eq, asc } from 'drizzle-orm';
import { db, vocabUnits, vocabThemes, vocabWords } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export interface StarterWord {
  id: number;
  word: string;
  pos: string;
  definition: string;
  exampleSentence: string;
  synonyms: string[];
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [firstUnit] = await db.select({ id: vocabUnits.id }).from(vocabUnits)
      .orderBy(asc(vocabUnits.order), asc(vocabUnits.id)).limit(1);
    if (!firstUnit) return NextResponse.json({ words: [] });

    const [firstTheme] = await db.select({ id: vocabThemes.id }).from(vocabThemes)
      .where(eq(vocabThemes.unitId, firstUnit.id))
      .orderBy(asc(vocabThemes.order), asc(vocabThemes.id)).limit(1);
    if (!firstTheme) return NextResponse.json({ words: [] });

    const rows = await db.select({
      id: vocabWords.id,
      word: vocabWords.word,
      partOfSpeech: vocabWords.partOfSpeech,
      definition: vocabWords.definition,
      exampleSentence: vocabWords.exampleSentence,
      synonyms: vocabWords.synonyms,
    }).from(vocabWords).where(eq(vocabWords.themeId, firstTheme.id)).orderBy(asc(vocabWords.id)).limit(3);

    if (rows.length < 3) return NextResponse.json({ words: [] });
    const words: StarterWord[] = rows.map(row => {
      let synonyms: string[] = [];
      try {
        const value = JSON.parse(row.synonyms);
        if (Array.isArray(value)) synonyms = value;
      } catch { /* Optional metadata cannot block first value. */ }
      return { id: row.id, word: row.word, pos: row.partOfSpeech, definition: row.definition, exampleSentence: row.exampleSentence, synonyms };
    });
    return NextResponse.json({ words });
  } catch {
    return NextResponse.json({ words: [] });
  }
}

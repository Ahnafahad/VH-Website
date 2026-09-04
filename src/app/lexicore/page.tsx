import type { Metadata, Viewport } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { db, vocabWords, vocabWordAltDefinitions, vocabWordContrasts } from '@/lib/db';
import { eq, and, isNotNull, or } from 'drizzle-orm';
import WelcomeFlow from './WelcomeFlow';
import type { LivingCardWord } from '@/components/vocab/LivingFlashcard';

export const metadata: Metadata = {
  title: 'LexiCore — learn words you can actually use',
  description: 'Most vocabulary apps check whether you remember a definition. LexiCore checks whether you can use the word.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0F0F0F',
  viewportFit: 'cover',
};

function safeParseArray(json: string | null): string[] {
  if (!json) return [];
  try { return JSON.parse(json) as string[]; } catch { return []; }
}

/** A word rich enough to show every card option at once. */
async function getDemoWord(): Promise<LivingCardWord | null> {
  const [row] = await db
    .select({
      id:              vocabWords.id,
      word:            vocabWords.word,
      definition:      vocabWords.definition,
      partOfSpeech:    vocabWords.partOfSpeech,
      synonyms:        vocabWords.synonyms,
      exampleSentence: vocabWords.exampleSentence,
      connotation:     vocabWords.connotation,
      altDefinition:   vocabWordAltDefinitions.altDefinition,
      contrastWord:    vocabWordContrasts.contrastWord,
      contrastGloss:   vocabWordContrasts.contrastGloss,
    })
    .from(vocabWords)
    .innerJoin(vocabWordAltDefinitions, eq(vocabWordAltDefinitions.wordId, vocabWords.id))
    .leftJoin(vocabWordContrasts, eq(vocabWordContrasts.wordId, vocabWords.id))
    .where(and(
      isNotNull(vocabWords.exampleSentence),
      or(eq(vocabWords.connotation, 'positive'), eq(vocabWords.connotation, 'negative')),
    ))
    .limit(1);

  if (!row) return null;
  return {
    id:              row.id,
    word:            row.word,
    definition:      row.definition,
    altDefinition:   row.altDefinition,
    partOfSpeech:    row.partOfSpeech,
    synonyms:        safeParseArray(row.synonyms),
    exampleSentence: row.exampleSentence,
    connotation:     row.connotation,
    contrast:        row.contrastWord && row.contrastGloss
      ? { word: row.contrastWord, gloss: row.contrastGloss }
      : null,
  };
}

export default async function LexiCoreWelcomePage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.email) redirect('/vocab');

  const demoWord = await getDemoWord();

  return <WelcomeFlow demoWord={demoWord} />;
}

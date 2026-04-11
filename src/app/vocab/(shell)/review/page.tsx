import { getServerSession } from 'next-auth';
import { redirect }         from 'next/navigation';
import { authOptions }      from '@/lib/auth';
import { and, count, eq, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, vocabUserWordRecords, vocabWords } from '@/lib/db/schema';
import ReviewScreen from './ReviewScreen';

export default async function ReviewPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin?callbackUrl=/vocab/review');

  const email = session.user.email;

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) redirect('/vocab/onboarding');

  const now = new Date();

  // Fetch due words with full word data
  const rows = await db
    .select({
      wordId:          vocabUserWordRecords.wordId,
      masteryLevel:    vocabUserWordRecords.masteryLevel,
      masteryScore:    vocabUserWordRecords.masteryScore,
      word:            vocabWords.word,
      definition:      vocabWords.definition,
      exampleSentence: vocabWords.exampleSentence,
      partOfSpeech:    vocabWords.partOfSpeech,
    })
    .from(vocabUserWordRecords)
    .innerJoin(vocabWords, eq(vocabUserWordRecords.wordId, vocabWords.id))
    .where(
      and(
        eq(vocabUserWordRecords.userId, user.id),
        eq(vocabUserWordRecords.inSrsPool, true),
        lte(vocabUserWordRecords.srsNextReviewDate, now),
      )
    )
    .orderBy(vocabUserWordRecords.srsNextReviewDate)
    .limit(30);

  const dueCount = rows.length;

  const words = rows.map(r => ({
    wordId:          r.wordId,
    word:            r.word,
    definition:      r.definition,
    exampleSentence: r.exampleSentence,
    partOfSpeech:    r.partOfSpeech,
    masteryLevel:    r.masteryLevel,
    masteryScore:    r.masteryScore,
  }));

  return <ReviewScreen words={words} dueCount={dueCount} />;
}

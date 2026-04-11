import { getServerSession } from 'next-auth';
import { redirect }         from 'next/navigation';
import { authOptions }      from '@/lib/auth';
import { and, eq, lte }     from 'drizzle-orm';
import { db }               from '@/lib/db';
import { users, vocabUserWordRecords } from '@/lib/db/schema';
import ReviewQuizClient from './ReviewQuizClient';

export default async function ReviewQuizPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin?callbackUrl=/vocab/review/quiz');

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  if (!user) redirect('/vocab/onboarding');

  const now = new Date();

  const rows = await db
    .select({ wordId: vocabUserWordRecords.wordId })
    .from(vocabUserWordRecords)
    .where(and(
      eq(vocabUserWordRecords.userId, user.id),
      eq(vocabUserWordRecords.inSrsPool, true),
      lte(vocabUserWordRecords.srsNextReviewDate, now),
    ))
    .orderBy(vocabUserWordRecords.srsNextReviewDate)
    .limit(30);

  if (rows.length === 0) redirect('/vocab/review');

  return <ReviewQuizClient wordIds={rows.map(r => r.wordId)} />;
}

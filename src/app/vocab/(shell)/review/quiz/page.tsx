import { getServerSession } from 'next-auth';
import { redirect }         from 'next/navigation';
import { authOptions }      from '@/lib/auth';
import { and, eq, lte }     from 'drizzle-orm';
import { db }               from '@/lib/db';
import { users, vocabUserWordRecords } from '@/lib/db/schema';
import { filterAccessibleWordIds } from '@/lib/vocab/access-check';
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

  // Over-fetch, then drop anything outside the user's unlocked set — trial
  // access is a word set, so it can't be expressed as a join condition here.
  const due = await db
    .select({ wordId: vocabUserWordRecords.wordId })
    .from(vocabUserWordRecords)
    .where(and(
      eq(vocabUserWordRecords.userId, user.id),
      eq(vocabUserWordRecords.inSrsPool, true),
      lte(vocabUserWordRecords.srsNextReviewDate, now),
    ))
    .orderBy(vocabUserWordRecords.srsNextReviewDate)
    .limit(120);

  const wordIds = (await filterAccessibleWordIds(user.id, due.map(r => r.wordId))).slice(0, 30);

  if (wordIds.length === 0) redirect('/vocab/review');

  return <ReviewQuizClient wordIds={wordIds} />;
}

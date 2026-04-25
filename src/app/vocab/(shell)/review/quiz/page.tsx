import { getServerSession } from 'next-auth';
import { redirect }         from 'next/navigation';
import { authOptions }      from '@/lib/auth';
import { and, eq, lte }     from 'drizzle-orm';
import { db }               from '@/lib/db';
import { users, vocabUserWordRecords, vocabWords, vocabUnits } from '@/lib/db/schema';
import { getUserPhase }     from '@/lib/vocab/access-check';
import { PHASE1_MAX_UNIT_ORDER } from '@/lib/vocab/constants';
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
  const phase = await getUserPhase(user.id);

  const rows = phase !== 2
    ? await db
        .select({ wordId: vocabUserWordRecords.wordId })
        .from(vocabUserWordRecords)
        .where(and(
          eq(vocabUserWordRecords.userId, user.id),
          eq(vocabUserWordRecords.inSrsPool, true),
          lte(vocabUserWordRecords.srsNextReviewDate, now),
        ))
        .orderBy(vocabUserWordRecords.srsNextReviewDate)
        .limit(30)
    : await db
        .select({ wordId: vocabUserWordRecords.wordId })
        .from(vocabUserWordRecords)
        .innerJoin(vocabWords, eq(vocabUserWordRecords.wordId, vocabWords.id))
        .innerJoin(vocabUnits, eq(vocabWords.unitId, vocabUnits.id))
        .where(and(
          eq(vocabUserWordRecords.userId, user.id),
          eq(vocabUserWordRecords.inSrsPool, true),
          lte(vocabUserWordRecords.srsNextReviewDate, now),
          lte(vocabUnits.order, PHASE1_MAX_UNIT_ORDER),
        ))
        .orderBy(vocabUserWordRecords.srsNextReviewDate)
        .limit(30);

  if (rows.length === 0) redirect('/vocab/review');

  return <ReviewQuizClient wordIds={rows.map(r => r.wordId)} />;
}

import { getServerSession }  from 'next-auth';
import { redirect }          from 'next/navigation';
import { authOptions }       from '@/lib/auth';
import { db, users, vocabUserProgress } from '@/lib/db';
import { eq }                from 'drizzle-orm';
import { getReviewWords }    from '@/lib/vocab/review-data';
import LetterStudyScreen     from '../letter/[letter]/LetterStudyScreen';

interface Props {
  searchParams: Promise<{ wordIds?: string }>;
}

export default async function ReviewStudyPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin?callbackUrl=/vocab/study');

  const { wordIds: wordIdsParam } = await searchParams;
  const wordIds = (wordIdsParam ?? '')
    .split(',')
    .map(Number)
    .filter(n => !isNaN(n) && n > 0);

  if (wordIds.length === 0) redirect('/vocab/study');

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  if (!user) redirect('/vocab/onboarding');

  const [words, progressRow] = await Promise.all([
    getReviewWords(user.id, wordIds),
    db.select({ totalPoints: vocabUserProgress.totalPoints })
      .from(vocabUserProgress)
      .where(eq(vocabUserProgress.userId, user.id))
      .limit(1).then(r => r[0]),
  ]);

  if (words.length === 0) redirect('/vocab/study');

  return (
    <LetterStudyScreen
      letter="Review"
      words={words}
      totalPoints={progressRow?.totalPoints ?? 0}
    />
  );
}

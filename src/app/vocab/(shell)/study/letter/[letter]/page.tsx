import { getServerSession }  from 'next-auth';
import { redirect }          from 'next/navigation';
import { authOptions }       from '@/lib/auth';
import { db, users, vocabUserProgress } from '@/lib/db';
import { eq }                from 'drizzle-orm';
import { getLetterWords }    from '@/lib/vocab/letter-data';
import LetterStudyScreen     from './LetterStudyScreen';

interface Props {
  params: Promise<{ letter: string }>;
}

export default async function LetterStudyPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin?callbackUrl=/vocab/study');

  const { letter } = await params;
  const upperLetter = letter.toUpperCase();
  if (!upperLetter.match(/^[A-Z]$/)) redirect('/vocab/study');

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  if (!user) redirect('/vocab/onboarding');

  const [words, progressRow] = await Promise.all([
    getLetterWords(user.id, upperLetter),
    db.select({ totalPoints: vocabUserProgress.totalPoints })
      .from(vocabUserProgress)
      .where(eq(vocabUserProgress.userId, user.id))
      .limit(1).then(r => r[0]),
  ]);

  return (
    <LetterStudyScreen
      letter={upperLetter}
      words={words}
      totalPoints={progressRow?.totalPoints ?? 0}
    />
  );
}

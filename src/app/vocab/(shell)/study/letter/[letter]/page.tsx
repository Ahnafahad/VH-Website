import { getServerSession }  from 'next-auth';
import { redirect }          from 'next/navigation';
import { authOptions }       from '@/lib/auth';
import { db, users, vocabUserProgress } from '@/lib/db';
import { eq }                from 'drizzle-orm';
import { getLetterWords }    from '@/lib/vocab/letter-data';
import { PHASE1_MAX_UNIT_ORDER } from '@/lib/vocab/constants';
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

  const progressRow = await db
    .select({ totalPoints: vocabUserProgress.totalPoints, phase: vocabUserProgress.phase })
    .from(vocabUserProgress)
    .where(eq(vocabUserProgress.userId, user.id))
    .limit(1)
    .then(r => r[0]);

  const phase = progressRow?.phase ?? 2;
  const maxUnitOrder = phase === 2 ? PHASE1_MAX_UNIT_ORDER : undefined;

  const words = await getLetterWords(user.id, upperLetter, maxUnitOrder);

  return (
    <LetterStudyScreen
      letter={upperLetter}
      words={words}
      totalPoints={progressRow?.totalPoints ?? 0}
    />
  );
}

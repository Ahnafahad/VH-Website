import { getServerSession } from 'next-auth';
import { redirect }         from 'next/navigation';
import { authOptions }      from '@/lib/auth';
import { getStudyData }     from '@/lib/vocab/study-data';
import { getLetterIndex }   from '@/lib/vocab/letter-data';
import { db, users }        from '@/lib/db';
import { eq }               from 'drizzle-orm';
import StudyScreen          from './StudyScreen';

export default async function StudyPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin?callbackUrl=/vocab/study');

  const t0 = performance.now();
  const data = await getStudyData(session.user.email);
  const t1 = performance.now();
  if (!data) redirect('/vocab/onboarding');

  // Fetch userId for letter index
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);
  const t2 = performance.now();

  const letterIndex = user ? await getLetterIndex(user.id) : [];
  const t3 = performance.now();

  console.log(
    `[DIAG study] studyData=${(t1 - t0).toFixed(0)}ms` +
    ` userLookup=${(t2 - t1).toFixed(0)}ms` +
    ` letterIndex=${(t3 - t2).toFixed(0)}ms` +
    ` total=${(t3 - t0).toFixed(0)}ms`
  );

  return <StudyScreen data={data} letterIndex={letterIndex} />;
}

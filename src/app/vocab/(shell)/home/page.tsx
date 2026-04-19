import { getServerSession } from 'next-auth';
import { redirect }         from 'next/navigation';
import { after }            from 'next/server';
import { authOptions }      from '@/lib/auth';
import { getHomeData }      from '@/lib/vocab/home-data';
import { getStudyData }     from '@/lib/vocab/study-data';
import { getPracticePageData } from '@/lib/vocab/practice-data';
import HomeScreen           from './HomeScreen';

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/registration/games?next=/vocab/home');

  const data = await getHomeData(session.user.email);
  if (!data) redirect('/vocab/onboarding');

  // After response is sent, silently warm study + practice caches for instant navigation
  const email = session.user.email;
  after(async () => {
    await Promise.all([
      getStudyData(email).catch(() => null),
      getPracticePageData(email).catch(() => null),
    ]);
  });

  return <HomeScreen data={data} />;
}

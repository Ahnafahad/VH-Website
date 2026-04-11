import { getServerSession } from 'next-auth';
import { redirect }         from 'next/navigation';
import { authOptions }      from '@/lib/auth';
import { getHomeData }      from '@/lib/vocab/home-data';
import HomeScreen           from './HomeScreen';

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin?callbackUrl=/vocab');

  const data = await getHomeData(session.user.email);
  if (!data) redirect('/vocab/onboarding');

  return <HomeScreen data={data} />;
}

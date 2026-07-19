import { getServerSession } from 'next-auth';
import { redirect }         from 'next/navigation';
import { authOptions }      from '@/lib/auth';
import GamesHubScreen       from './GamesHubScreen';

export default async function GamesHubPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/registration/games?next=/vocab/games');

  return <GamesHubScreen />;
}

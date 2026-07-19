import { getServerSession } from 'next-auth';
import { redirect }         from 'next/navigation';
import { authOptions }      from '@/lib/auth';
import WordChargeScreen     from './WordChargeScreen';

export default async function WordChargePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/registration/games?next=/vocab/games/word-charge');

  return <WordChargeScreen />;
}

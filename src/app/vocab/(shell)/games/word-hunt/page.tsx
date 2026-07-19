import { getServerSession } from 'next-auth';
import { redirect }         from 'next/navigation';
import { authOptions }      from '@/lib/auth';
import WordHuntScreen       from './WordHuntScreen';

export default async function WordHuntPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/registration/games?next=/vocab/games/word-hunt');

  const { date } = await searchParams;
  const requestedDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;

  return <WordHuntScreen date={requestedDate} />;
}

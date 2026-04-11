import { getServerSession } from 'next-auth';
import { redirect }         from 'next/navigation';
import { authOptions }      from '@/lib/auth';
import { getFlashcardSession } from '@/lib/vocab/flashcard-data';
import FlashcardScreen      from './FlashcardScreen';

interface Props {
  params: Promise<{ themeId: string }>;
}

export default async function FlashcardPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin?callbackUrl=/vocab/study');

  const { themeId } = await params;
  const id = parseInt(themeId, 10);
  if (isNaN(id)) redirect('/vocab/study');

  const data = await getFlashcardSession(session.user.email, id);
  if (!data) redirect('/vocab/study');

  return <FlashcardScreen data={data} />;
}

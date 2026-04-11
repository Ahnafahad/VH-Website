import { getServerSession } from 'next-auth';
import { redirect }         from 'next/navigation';
import { authOptions }      from '@/lib/auth';
import { getPracticePageData } from '@/lib/vocab/practice-data';
import PracticeScreen          from './PracticeScreen';

export default async function PracticePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin?callbackUrl=/vocab/practice');

  const data = await getPracticePageData(session.user.email);
  if (!data) redirect('/vocab/onboarding');

  return <PracticeScreen data={data} />;
}

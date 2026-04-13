import { getServerSession } from 'next-auth';
import { redirect }         from 'next/navigation';
import { authOptions }      from '@/lib/auth';
import { getPracticePageData } from '@/lib/vocab/practice-data';
import PracticeScreen          from './PracticeScreen';

export default async function PracticePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin?callbackUrl=/vocab/practice');

  const t0 = performance.now();
  const data = await getPracticePageData(session.user.email);
  const t1 = performance.now();
  if (!data) redirect('/vocab/onboarding');

  console.log(`[DIAG practice] total=${(t1 - t0).toFixed(0)}ms`);

  return <PracticeScreen data={data} />;
}

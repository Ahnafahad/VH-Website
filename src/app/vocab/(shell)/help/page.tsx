import { getServerSession } from 'next-auth';
import { redirect }         from 'next/navigation';
import { authOptions }      from '@/lib/auth';
import HelpScreen           from './HelpScreen';

export const metadata = {
  title: 'Help — LexiCore',
};

export default async function HelpPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/auth/signin?callbackUrl=/vocab/help');

  return <HelpScreen />;
}

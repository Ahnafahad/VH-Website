import { getServerSession }    from 'next-auth';
import { redirect }            from 'next/navigation';
import { authOptions }         from '@/lib/auth';
import { getLeaderboardData }  from '@/lib/vocab/leaderboard-data';
import LeaderboardScreen       from './LeaderboardScreen';

export default async function LeaderboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin?callbackUrl=/vocab/leaderboard');

  const data = await getLeaderboardData(session.user.email);
  if (!data) redirect('/vocab/onboarding');

  return <LeaderboardScreen data={data} />;
}

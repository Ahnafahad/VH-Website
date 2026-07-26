import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import NotificationSettings from '@/components/settings/NotificationSettings';

export const metadata = { title: 'Settings — VH' };

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#1A0507' }}>
      <div
        className="max-w-lg mx-auto px-4 sm:px-6 pb-24"
        style={{ paddingTop: 'max(6rem, calc(6rem + env(safe-area-inset-top)))' }}
      >
        <h1
          className="font-heading font-medium text-3xl sm:text-4xl mb-1"
          style={{ color: '#FAF5EF', letterSpacing: '-0.02em' }}
        >
          Settings
        </h1>
        <p className="text-sm mb-8" style={{ color: 'rgba(250,245,239,0.64)' }}>
          Manage how VH keeps you in the loop.
        </p>

        <NotificationSettings />
      </div>
    </main>
  );
}

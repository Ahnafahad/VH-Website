import type { Metadata, Viewport } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import UpgradeClient from './UpgradeClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Upgrade LexiCore' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0F0F0F', viewportFit: 'cover' };

export default async function LexiCoreUpgradePage() {
  const session = await getServerSession(authOptions);
  return <UpgradeClient signedIn={!!session?.user?.email} />;
}

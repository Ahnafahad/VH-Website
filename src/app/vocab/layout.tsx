import type { Metadata, Viewport } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'LexiCore — VH Vocabulary',
  description: 'Master 800+ words through smart flashcards, AI-powered quizzes, and daily practice.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'LexiCore',
  },
  icons: {
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0F0F0F',
  viewportFit: 'cover',
};

export default async function VocabRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/auth/signin?callbackUrl=/vocab');

  return <>{children}</>;
}

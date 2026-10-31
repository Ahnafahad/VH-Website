import type { Metadata } from 'next';
import MockRegisterClient from './MockRegisterClient';

// Shared by link on announcements only: not in the nav, sitemap or search results.
export const metadata: Metadata = {
  title: 'Mock Registration | Beyond the Horizons',
  robots: { index: false, follow: false },
};

export default function MockRegisterPage() {
  return <MockRegisterClient />;
}

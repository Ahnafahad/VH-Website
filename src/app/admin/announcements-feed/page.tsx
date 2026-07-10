import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AnnouncementsFeedClient from '@/components/admin/lms/AnnouncementsFeedClient';
import type { LmsAnnouncement } from '@/components/admin/lms/AnnouncementsFeedClient';
import { adminApiFetch } from '@/lib/lms/admin-fetch';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Announcement Feed | Admin' };

export default async function AnnouncementsFeedPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');

  const res = await adminApiFetch('/api/lms/admin/announcements-feed');
  const initialAnnouncements: LmsAnnouncement[] = res.ok ? await res.json() as LmsAnnouncement[] : [];

  return <AnnouncementsFeedClient initialAnnouncements={initialAnnouncements} />;
}

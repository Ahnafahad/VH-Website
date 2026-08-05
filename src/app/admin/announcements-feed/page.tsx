import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AnnouncementsFeedClient from '@/components/admin/lms/AnnouncementsFeedClient';
import type { LmsAnnouncement } from '@/components/admin/lms/AnnouncementsFeedClient';
import { adminApiFetch } from '@/lib/lms/admin-fetch';
import { getActiveBatches } from '@/lib/batches/read';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Announcement Feed | Admin' };

export default async function AnnouncementsFeedPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');

  const res = await adminApiFetch('/api/lms/admin/announcements-feed');
  const initialAnnouncements: LmsAnnouncement[] = res.ok ? await res.json() as LmsAnnouncement[] : [];

  // getActiveBatches is server-only — fetched here and passed as a prop, same
  // pattern as initialAnnouncements above, so the batch field can be a
  // DB-backed dropdown instead of free text.
  let batches: { id: number; name: string; product: string }[] = [];
  try {
    batches = await getActiveBatches();
  } catch {
    // Degrade gracefully — batches table may be empty/unseeded.
    batches = [];
  }

  return <AnnouncementsFeedClient initialAnnouncements={initialAnnouncements} batches={batches} />;
}

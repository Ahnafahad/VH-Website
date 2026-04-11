/**
 * /admin/announcements — Server Component shell
 *
 * Fetches the current recipient count from the API (using the admin session
 * that the layout already validated), then hands off to the Client Component.
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db, users } from '@/lib/db';
import { ne } from 'drizzle-orm';
import AnnouncementsClient from '@/components/admin/AnnouncementsClient';

export const metadata = {
  title: 'Announcements — VH Admin',
};

export default async function AnnouncementsPage() {
  // Session is already validated by the layout — this is a safe direct query.
  const session = await getServerSession(authOptions);
  const adminName = session?.user?.name ?? 'Admin';

  let recipientCount = 0;
  try {
    const rows = await db
      .select({ email: users.email })
      .from(users)
      .where(ne(users.status, 'inactive'));
    recipientCount = rows.length;
  } catch {
    // Fail gracefully — client will show 0 recipients.
    recipientCount = 0;
  }

  return (
    <AnnouncementsClient
      recipientCount={recipientCount}
      adminName={adminName}
    />
  );
}

/**
 * /admin/announcements — Server Component shell
 *
 * Fetches the current recipient count from the API (using the admin session
 * that the layout already validated), then hands off to the Client Component.
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { resolveAudience } from '@/lib/audience/resolve';
import { getActiveBatches } from '@/lib/batches/read';
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
    const recipients = await resolveAudience(db, { mode: 'everyone' });
    recipientCount = recipients.length;
  } catch {
    // Fail gracefully — client will show 0 recipients.
    recipientCount = 0;
  }

  // getActiveBatches is server-only (imports the db client), so the batch
  // dropdown is populated via this server-component prop rather than a
  // client-side fetch — matches how this page already hands the client its
  // initial data (recipientCount above).
  let batches: { id: number; name: string; product: string }[] = [];
  try {
    batches = await getActiveBatches();
  } catch {
    // Degrade gracefully — batches table may be empty/unseeded.
    batches = [];
  }

  return (
    <AnnouncementsClient
      recipientCount={recipientCount}
      adminName={adminName}
      batches={batches}
    />
  );
}

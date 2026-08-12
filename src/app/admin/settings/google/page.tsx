/**
 * /admin/settings/google — Google Calendar host-connect page.
 *
 * Server Component: fetches current connection status.
 * Client part: Connect / Reconnect / Disconnect buttons.
 */

import { Suspense } from 'react';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { googleCredentials, users } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import GoogleCalendarClient from './GoogleCalendarClient';
import { isMeetAutoCreateEnabled } from '@/lib/lms/settings';
import { SLATE, MUTED, INK_SOFT, FONT_HEADING, T_BASE, T_2XL } from '@/components/admin/lms/tokens';

export const metadata = { title: 'Google Calendar — Admin' };

async function getGoogleStatus() {
  const rows = await db
    .select({
      id:        googleCredentials.id,
      userId:    googleCredentials.userId,
      expiresAt: googleCredentials.expiresAt,
      updatedAt: googleCredentials.updatedAt,
    })
    .from(googleCredentials)
    .orderBy(desc(googleCredentials.updatedAt))
    .limit(1);

  if (rows.length === 0) return { connected: false as const };

  const cred = rows[0];
  const hostUser = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, cred.userId))
    .get();

  return {
    connected:  true as const,
    email:      hostUser?.email ?? null,
    name:       hostUser?.name  ?? null,
    expiresAt:  cred.expiresAt.getTime(),
    updatedAt:  cred.updatedAt.getTime(),
  };
}

export default async function GoogleSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');
  const role = session.user.role;
  if (role !== 'admin' && role !== 'super_admin' && role !== 'instructor') {
    redirect('/admin');
  }

  const sp             = await searchParams;
  const [status, meetAutoCreate] = await Promise.all([
    getGoogleStatus(),
    isMeetAutoCreateEnabled(),
  ]);

  return (
    <div style={{ maxWidth: 560 }}>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontFamily:    FONT_HEADING,
            fontSize:      T_2XL,
            fontWeight:    700,
            color:         SLATE,
            letterSpacing: '-0.03em',
            margin:        0,
          }}
        >
          Google Calendar
        </h1>
        <p style={{ fontSize: T_BASE, color: MUTED, marginTop: 6, lineHeight: 1.5 }}>
          Connect one Google account to auto-create Meet links for every class. All
          batch students are invited automatically.{' '}
          <strong style={{ color: INK_SOFT }}>
            This is separate from student sign-in — calendar scope never touches the
            login flow.
          </strong>
        </p>
      </div>

      <Suspense fallback={null}>
        <GoogleCalendarClient
          status={status}
          flashConnected={sp.connected === '1'}
          flashError={sp.error ?? null}
          meetAutoCreate={meetAutoCreate}
        />
      </Suspense>
    </div>
  );
}

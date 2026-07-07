/**
 * /dashboard/classes/[id]/recording
 *
 * Server component: validates session, checks scope, then renders the player.
 * Redirects to /dashboard if the recording is not found or access is denied.
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { classSessions, recordings } from '@/lib/db/schema';
import { getUserByEmail } from '@/lib/db-access-control';
import { canAccessLmsContent } from '@/lib/lms/access';
import RecordingPlayer from '@/components/lms/RecordingPlayer';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessionId = parseInt(id, 10);
  if (isNaN(sessionId)) return { title: 'Recording | VH' };

  const session = await db
    .select({ title: classSessions.title })
    .from(classSessions)
    .where(eq(classSessions.id, sessionId))
    .get();

  return { title: session ? `${session.title} — Recording | VH` : 'Recording | VH' };
}

export default async function RecordingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessionId = parseInt(id, 10);
  if (isNaN(sessionId)) redirect('/dashboard');

  // Auth check
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.email) redirect('/auth/signin');

  const user = await getUserByEmail(authSession.user.email);
  if (!user) redirect('/auth/signin');

  // Load class session + recording
  const row = await db
    .select({ session: classSessions, rec: recordings })
    .from(classSessions)
    .innerJoin(recordings, eq(recordings.classSessionId, classSessions.id))
    .where(eq(classSessions.id, sessionId))
    .get();

  if (!row) redirect('/dashboard');

  const { session, rec } = row;

  // Scope check (server-side; player does a second check when fetching the URL)
  if (!canAccessLmsContent(user, { product: session.product, batch: session.batch })) {
    redirect('/dashboard');
  }

  return (
    <RecordingPlayer
      recordingId={rec.id}
      sessionTitle={session.title}
      subject={session.subject}
      scheduledAt={session.scheduledAt.getTime()}
      durationSeconds={rec.durationSeconds}
      recordingStatus={rec.status}
    />
  );
}

/**
 * POST /api/lms/admin/classes/[id]/retry-bot
 *
 * Manually re-schedules a Skribby recording bot for a session's existing
 * meet link — used from the admin class detail page when a bot failed to
 * join (not_admitted, etc.) and staff want it to try again right now.
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { classSessions, recordings } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { getRecordingProvider } from '@/lib/recording/skribby';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    await requireStaff();
    const { id } = await params;
    const sessionId = parseInt(id, 10);
    if (isNaN(sessionId)) throw new ApiException('Invalid id', 400);

    const session = await db
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, sessionId))
      .get();
    if (!session) throw new ApiException('Session not found', 404);
    if (!session.meetLink) throw new ApiException('This session has no meet link to join', 400);

    const provider = getRecordingProvider();
    if (!provider) throw new ApiException('Recording provider is not configured', 503);

    // Skribby rejects a scheduled_start_time that isn't strictly in the future.
    const { botId } = await provider.scheduleBot({
      meetingUrl: session.meetLink,
      joinAt: new Date(Date.now() + 60_000),
    });

    await db
      .update(classSessions)
      .set({ recallBotId: botId })
      .where(eq(classSessions.id, sessionId));

    const existingRecording = await db
      .select({ id: recordings.id })
      .from(recordings)
      .where(eq(recordings.classSessionId, sessionId))
      .get();

    if (existingRecording) {
      await db
        .update(recordings)
        .set({ status: 'pending', errorMessage: null })
        .where(eq(recordings.id, existingRecording.id));
    } else {
      await db.insert(recordings).values({
        classSessionId: sessionId,
        r2Key: `recordings/${sessionId}.mp4`,
        status: 'pending',
        source: 'skribby',
      });
    }

    return { recallBotId: botId, recordingStatus: 'pending' };
  });
}

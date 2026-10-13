/**
 * Records the recording bot's live progress (from provider status webhooks)
 * on the class's recordings row, so the Today cockpit's recorder strip can
 * show "joined at" / "recording since" without calling the provider.
 * Best-effort: callers must not let a failure here affect the webhook reply.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { classSessions, recordings } from '@/lib/db/schema';
import { classifyBotStatus } from '@/lib/lms/today-cockpit';

export async function recordBotProgress(botId: string, rawStatus: string): Promise<void> {
  const session = await db
    .select({ id: classSessions.id })
    .from(classSessions)
    .where(eq(classSessions.recallBotId, botId))
    .get();
  if (!session) return;

  const row = await db
    .select({ id: recordings.id, botJoinedAt: recordings.botJoinedAt, botRecordingAt: recordings.botRecordingAt })
    .from(recordings)
    .where(eq(recordings.classSessionId, session.id))
    .get();
  if (!row) return;

  const now = new Date();
  const kind = classifyBotStatus(rawStatus);
  await db
    .update(recordings)
    .set({
      botStatus: rawStatus,
      botStatusAt: now,
      ...((kind === 'in_meeting' || kind === 'recording') && !row.botJoinedAt ? { botJoinedAt: now } : {}),
      ...(kind === 'recording' && !row.botRecordingAt ? { botRecordingAt: now } : {}),
    })
    .where(eq(recordings.id, row.id));
}

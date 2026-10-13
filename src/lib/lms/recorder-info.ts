/**
 * Server-side loader for the recorder strip: one grouped query for any number
 * of sessions (used by /api/lms/admin/today and the 15 s recorder poll).
 */

import { inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recordings } from '@/lib/db/schema';
import type { RecorderRecording } from '@/lib/lms/today-cockpit';

export async function loadRecordings(sessionIds: number[]): Promise<Map<number, RecorderRecording>> {
  const map = new Map<number, RecorderRecording>();
  if (sessionIds.length === 0) return map;
  const rows = await db
    .select({
      classSessionId: recordings.classSessionId,
      status: recordings.status,
      errorMessage: recordings.errorMessage,
      durationSeconds: recordings.durationSeconds,
      botStatus: recordings.botStatus,
      botStatusAt: recordings.botStatusAt,
      botJoinedAt: recordings.botJoinedAt,
      botRecordingAt: recordings.botRecordingAt,
    })
    .from(recordings)
    .where(inArray(recordings.classSessionId, sessionIds));
  for (const r of rows) {
    map.set(r.classSessionId, {
      status: r.status,
      errorMessage: r.errorMessage,
      durationSeconds: r.durationSeconds,
      botStatus: r.botStatus,
      botStatusAt: r.botStatusAt?.getTime() ?? null,
      botJoinedAt: r.botJoinedAt?.getTime() ?? null,
      botRecordingAt: r.botRecordingAt?.getTime() ?? null,
    });
  }
  return map;
}

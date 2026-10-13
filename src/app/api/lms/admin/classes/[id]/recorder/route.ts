/**
 * GET /api/lms/admin/classes/[id]/recorder
 * Lightweight recorder status for the Today cockpit's recorder strip, polled
 * every ~15 s while a class is live. Staff only; read-only.
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { classSessions } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { loadRecordings } from '@/lib/lms/recorder-info';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    await requireStaff();
    const { id } = await params;
    const sessionId = parseInt(id, 10);
    if (isNaN(sessionId)) throw new ApiException('Invalid id', 400);

    const session = await db
      .select({
        id: classSessions.id,
        status: classSessions.status,
        meetLink: classSessions.meetLink,
        recallBotId: classSessions.recallBotId,
      })
      .from(classSessions)
      .where(eq(classSessions.id, sessionId))
      .get();
    if (!session) throw new ApiException('Session not found', 404);

    const recording = (await loadRecordings([sessionId])).get(sessionId) ?? null;
    return {
      sessionId,
      status: session.status,
      meetLink: session.meetLink,
      recallBotId: session.recallBotId,
      recording,
    };
  });
}

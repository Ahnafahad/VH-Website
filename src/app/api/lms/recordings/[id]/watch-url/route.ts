/**
 * GET /api/lms/recordings/[id]/watch-url
 *
 * Returns a presigned R2 URL (2 h TTL) if algorithm A deems the recording
 * watchable for the requesting user, plus resumeAt and durationSeconds.
 */

import { NextRequest } from 'next/server';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  recordings,
  classSessions,
  recordingAccessGrants,
  recordingWatchProgress,
} from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { canAccessLmsContent } from '@/lib/lms/access';
import { countSubsequentCompletedClasses } from '@/lib/lms/recording-expiry-db';
import { isRecordingWatchable } from '@/lib/lms/recording-expiry';
import { r2PresignGet } from '@/lib/storage/r2';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const { id } = await params;
    const recordingId = parseInt(id, 10);
    if (isNaN(recordingId)) throw new ApiException('Invalid id', 400);

    // Load recording + its session in one joined query
    const row = await db
      .select({
        rec: recordings,
        session: classSessions,
      })
      .from(recordings)
      .innerJoin(classSessions, eq(recordings.classSessionId, classSessions.id))
      .where(eq(recordings.id, recordingId))
      .get();

    if (!row) throw new ApiException('Recording not found', 404);
    const { rec, session } = row;

    // Scope check: does the user have access to this class?
    if (!canAccessLmsContent(user, { product: session.product, batch: session.batch })) {
      throw new ApiException('Access denied', 403, 'LMS_ACCESS_DENIED');
    }

    const isStaff =
      user.role === 'admin' || user.role === 'super_admin' || user.role === 'instructor';

    // Algorithm A inputs
    const subsequentCompletedCount = await countSubsequentCompletedClasses(session);

    // Active grant check: for this user (or batch-wide null)
    const now = new Date();
    const grantRow = await db
      .select({ id: recordingAccessGrants.id })
      .from(recordingAccessGrants)
      .where(
        and(
          eq(recordingAccessGrants.recordingId, recordingId),
          or(
            eq(recordingAccessGrants.userId, user.id),
            isNull(recordingAccessGrants.userId),
          ),
          gt(recordingAccessGrants.expiresAt, now),
        ),
      )
      .limit(1)
      .get();

    const activeGrantExists = !!grantRow;

    const { watchable, reason } = isRecordingWatchable({
      recordingStatus: rec.status,
      subsequentCompletedCount,
      activeGrantExists,
      isStaff,
    });

    if (!watchable) {
      throw new ApiException(
        reason === 'not_ready'
          ? 'Recording is not yet available'
          : reason === 'expired_window'
          ? 'Recording window has closed — ask your instructor for an extension'
          : 'Recording not available',
        403,
        reason.toUpperCase(),
      );
    }

    // Fetch resume position for this user
    const progress = await db
      .select({ lastPositionSeconds: recordingWatchProgress.lastPositionSeconds })
      .from(recordingWatchProgress)
      .where(
        and(
          eq(recordingWatchProgress.recordingId, recordingId),
          eq(recordingWatchProgress.userId, user.id),
        ),
      )
      .limit(1)
      .get();

    // Generate presigned URL (2 h TTL)
    const url = await r2PresignGet(rec.r2Key, 7200);

    return {
      url,
      resumeAt: progress?.lastPositionSeconds ?? 0,
      durationSeconds: rec.durationSeconds ?? null,
    };
  });
}

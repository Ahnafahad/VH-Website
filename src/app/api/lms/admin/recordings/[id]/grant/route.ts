/**
 * POST /api/lms/admin/recordings/[id]/grant
 *
 * Create an access-extension grant for a recording.
 * Body: { userId?: number | null; expiresAt: string (ISO) }
 *   userId null = whole-batch grant
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recordings, recordingAccessGrants } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    const staff = await requireStaff();
    const { id } = await params;
    const recordingId = parseInt(id, 10);
    if (isNaN(recordingId)) throw new ApiException('Invalid id', 400);

    const recording = await db
      .select({ id: recordings.id })
      .from(recordings)
      .where(eq(recordings.id, recordingId))
      .get();
    if (!recording) throw new ApiException('Recording not found', 404);

    const body = await req.json() as { userId?: number | null; expiresAt?: unknown };

    const userId =
      body.userId === null || body.userId === undefined ? null : Number(body.userId);
    if (userId !== null && isNaN(userId)) {
      throw new ApiException('userId must be a number or null', 400);
    }

    if (!body.expiresAt || typeof body.expiresAt !== 'string') {
      throw new ApiException('expiresAt is required (ISO string)', 400);
    }
    const expiresAt = new Date(body.expiresAt);
    if (isNaN(expiresAt.getTime())) {
      throw new ApiException('expiresAt must be a valid ISO date string', 400);
    }
    if (expiresAt.getTime() <= Date.now()) {
      throw new ApiException('expiresAt must be in the future', 400);
    }

    const [grant] = await db
      .insert(recordingAccessGrants)
      .values({
        recordingId,
        userId: userId ?? undefined,
        expiresAt,
        grantedBy: staff.id,
      })
      .returning();

    return {
      id: grant.id,
      recordingId: grant.recordingId,
      userId: grant.userId,
      expiresAt: grant.expiresAt.getTime(),
      grantedBy: grant.grantedBy,
      createdAt: grant.createdAt.getTime(),
    };
  });
}

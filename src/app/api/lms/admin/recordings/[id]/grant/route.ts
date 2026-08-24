/**
 * POST /api/lms/admin/recordings/[id]/grant
 *
 * Create access-extension grant(s) for a recording.
 * Body: { userId?: number | null; expiresAt: string (ISO) }  — single grant, userId null = whole-batch
 *    or { userIds: number[]; expiresAt: string (ISO) }        — one grant per student
 * Returns a single grant object for `userId`, or an array of grants for `userIds`.
 */

import { NextRequest } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recordings, recordingAccessGrants } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';

function toGrantJson(grant: typeof recordingAccessGrants.$inferSelect) {
  return {
    id: grant.id,
    recordingId: grant.recordingId,
    userId: grant.userId,
    expiresAt: grant.expiresAt.getTime(),
    grantedBy: grant.grantedBy,
    createdAt: grant.createdAt.getTime(),
  };
}

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

    const body = await req.json() as { userId?: number | null; userIds?: unknown; expiresAt?: unknown };

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

    // Multi-student grant — one row per selected student, skipping anyone who
    // already has a grant on this recording so re-submitting a selection
    // doesn't create duplicate rows.
    if (Array.isArray(body.userIds)) {
      const userIds = body.userIds.map((v) => Number(v));
      if (userIds.some((v) => isNaN(v))) {
        throw new ApiException('userIds must be an array of numbers', 400);
      }
      if (userIds.length === 0) {
        throw new ApiException('userIds must not be empty', 400);
      }

      const existing = await db
        .select({ userId: recordingAccessGrants.userId })
        .from(recordingAccessGrants)
        .where(and(eq(recordingAccessGrants.recordingId, recordingId), inArray(recordingAccessGrants.userId, userIds)));
      const alreadyGranted = new Set(existing.map((g) => g.userId));
      const toInsert = userIds.filter((uid) => !alreadyGranted.has(uid));

      if (toInsert.length === 0) return [];

      const inserted = await db
        .insert(recordingAccessGrants)
        .values(toInsert.map((userId) => ({ recordingId, userId, expiresAt, grantedBy: staff.id })))
        .returning();

      return inserted.map(toGrantJson);
    }

    const userId =
      body.userId === null || body.userId === undefined ? null : Number(body.userId);
    if (userId !== null && isNaN(userId)) {
      throw new ApiException('userId must be a number or null', 400);
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

    return toGrantJson(grant);
  });
}

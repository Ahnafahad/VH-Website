/**
 * PATCH  /api/admin/tests/windows/[windowId] — staff: activate/close/reschedule
 *   Body: { status?: 'scheduled'|'open'|'closed', opensAt?: number,
 *           closesAt?: number, durationMinutes?: number | null }
 * DELETE /api/admin/tests/windows/[windowId] — staff: remove a window with no attempts
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { testWindows, testAttempts } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';

const bodySchema = z.object({
  status: z.enum(['scheduled', 'open', 'closed']).optional(),
  opensAt: z.number().int().positive().optional(),
  closesAt: z.number().int().positive().optional(),
  durationMinutes: z.number().int().positive().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ windowId: string }> },
) {
  return safeApiHandler(async () => {
    await requireStaff();
    const windowId = parseInt((await params).windowId, 10);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiException('Invalid body', 400);
    const { status, opensAt, closesAt, durationMinutes } = parsed.data;

    const window = await db.select().from(testWindows)
      .where(eq(testWindows.id, windowId)).get();
    if (!window) throw new ApiException('Window not found', 404);

    const nextOpens = opensAt !== undefined ? new Date(opensAt) : window.opensAt;
    const nextCloses = closesAt !== undefined ? new Date(closesAt) : window.closesAt;
    if (nextCloses <= nextOpens) throw new ApiException('closesAt must be after opensAt', 400);

    await db.update(testWindows).set({
      ...(status !== undefined ? { status } : {}),
      opensAt: nextOpens,
      closesAt: nextCloses,
      ...(durationMinutes !== undefined ? { durationMinutes } : {}),
    }).where(eq(testWindows.id, windowId));

    return { updated: true };
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ windowId: string }> },
) {
  return safeApiHandler(async () => {
    await requireStaff();
    const windowId = parseInt((await params).windowId, 10);

    const attempt = await db.select({ id: testAttempts.id }).from(testAttempts)
      .where(eq(testAttempts.windowId, windowId)).get();
    if (attempt) {
      throw new ApiException('Window has attempts and cannot be deleted; close it instead', 409);
    }

    await db.delete(testWindows).where(eq(testWindows.id, windowId));
    return { deleted: true };
  });
}

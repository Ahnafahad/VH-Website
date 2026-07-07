/**
 * PATCH  /api/lms/admin/schedules/[id] — update a schedule
 * DELETE /api/lms/admin/schedules/[id] — delete a schedule
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { classSchedules } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { LMS_SUBJECTS } from '@/lib/lms/constants';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    await requireStaff();
    const { id } = await params;
    const scheduleId = parseInt(id, 10);
    if (isNaN(scheduleId)) throw new ApiException('Invalid id', 400);

    const existing = await db
      .select()
      .from(classSchedules)
      .where(eq(classSchedules.id, scheduleId))
      .get();
    if (!existing) throw new ApiException('Schedule not found', 404);

    const body = await req.json();
    const updates: Partial<typeof classSchedules.$inferInsert> = {};

    if (body.titleTemplate !== undefined) {
      if (typeof body.titleTemplate !== 'string') throw new ApiException('titleTemplate must be a string', 400);
      updates.titleTemplate = body.titleTemplate;
    }
    if (body.subject !== undefined) {
      if (!(LMS_SUBJECTS as readonly string[]).includes(body.subject)) {
        throw new ApiException(`subject must be one of: ${LMS_SUBJECTS.join(', ')}`, 400);
      }
      updates.subject = body.subject;
    }
    if (body.product !== undefined) updates.product = body.product;
    if (body.batch !== undefined) updates.batch = body.batch ?? null;
    if (body.dayOfWeek !== undefined) {
      if (typeof body.dayOfWeek !== 'number' || body.dayOfWeek < 0 || body.dayOfWeek > 6) {
        throw new ApiException('dayOfWeek must be 0–6', 400);
      }
      updates.dayOfWeek = body.dayOfWeek;
    }
    if (body.timeOfDay !== undefined) {
      if (!/^\d{2}:\d{2}$/.test(body.timeOfDay)) throw new ApiException('timeOfDay must be HH:mm', 400);
      updates.timeOfDay = body.timeOfDay;
    }
    if (body.durationMinutes !== undefined) {
      if (typeof body.durationMinutes !== 'number' || body.durationMinutes < 1) {
        throw new ApiException('durationMinutes must be a positive number', 400);
      }
      updates.durationMinutes = body.durationMinutes;
    }
    if (body.active !== undefined) updates.active = Boolean(body.active);

    if (Object.keys(updates).length === 0) throw new ApiException('No fields to update', 400);

    const [updated] = await db
      .update(classSchedules)
      .set(updates)
      .where(eq(classSchedules.id, scheduleId))
      .returning();

    return {
      id: updated.id,
      titleTemplate: updated.titleTemplate,
      subject: updated.subject,
      product: updated.product,
      batch: updated.batch,
      dayOfWeek: updated.dayOfWeek,
      timeOfDay: updated.timeOfDay,
      durationMinutes: updated.durationMinutes,
      active: updated.active,
      createdAt: updated.createdAt.getTime(),
    };
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    await requireStaff();
    const { id } = await params;
    const scheduleId = parseInt(id, 10);
    if (isNaN(scheduleId)) throw new ApiException('Invalid id', 400);

    const existing = await db
      .select()
      .from(classSchedules)
      .where(eq(classSchedules.id, scheduleId))
      .get();
    if (!existing) throw new ApiException('Schedule not found', 404);

    await db
      .delete(classSchedules)
      .where(eq(classSchedules.id, scheduleId));

    return { deleted: true };
  });
}

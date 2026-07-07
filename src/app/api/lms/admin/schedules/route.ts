/**
 * GET  /api/lms/admin/schedules — list all class schedules
 * POST /api/lms/admin/schedules — create a schedule
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { classSchedules } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { LMS_SUBJECTS } from '@/lib/lms/constants';
import { desc } from 'drizzle-orm';

export async function GET() {
  return safeApiHandler(async () => {
    await requireStaff();
    const rows = await db
      .select()
      .from(classSchedules)
      .orderBy(desc(classSchedules.createdAt));
    return rows.map(serializeSchedule);
  });
}

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const staff = await requireStaff();
    const body = await req.json();

    const { titleTemplate, subject, product, batch, dayOfWeek, timeOfDay, durationMinutes, active } = body;

    if (!titleTemplate || typeof titleTemplate !== 'string') {
      throw new ApiException('titleTemplate is required', 400);
    }
    if (!subject || !(LMS_SUBJECTS as readonly string[]).includes(subject)) {
      throw new ApiException(`subject must be one of: ${LMS_SUBJECTS.join(', ')}`, 400);
    }
    if (!product || typeof product !== 'string') {
      throw new ApiException('product is required', 400);
    }
    if (typeof dayOfWeek !== 'number' || dayOfWeek < 0 || dayOfWeek > 6) {
      throw new ApiException('dayOfWeek must be 0–6', 400);
    }
    if (!timeOfDay || !/^\d{2}:\d{2}$/.test(timeOfDay)) {
      throw new ApiException('timeOfDay must be HH:mm', 400);
    }
    if (typeof durationMinutes !== 'number' || durationMinutes < 1) {
      throw new ApiException('durationMinutes must be a positive number', 400);
    }

    const [created] = await db
      .insert(classSchedules)
      .values({
        titleTemplate,
        subject,
        product,
        batch: batch ?? null,
        dayOfWeek,
        timeOfDay,
        durationMinutes,
        active: active !== false,
        createdBy: staff.id,
      })
      .returning();

    return serializeSchedule(created);
  });
}

function serializeSchedule(s: typeof classSchedules.$inferSelect) {
  return {
    id: s.id,
    titleTemplate: s.titleTemplate,
    subject: s.subject,
    product: s.product,
    batch: s.batch,
    dayOfWeek: s.dayOfWeek,
    timeOfDay: s.timeOfDay,
    durationMinutes: s.durationMinutes,
    active: s.active,
    createdBy: s.createdBy,
    createdAt: s.createdAt.getTime(),
  };
}

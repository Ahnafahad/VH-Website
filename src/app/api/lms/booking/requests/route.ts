/**
 * GET  /api/lms/booking/requests — my requests list
 * POST /api/lms/booking/requests — submit a new session request
 */

import { NextRequest } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { sessionRequests } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { LMS_SUBJECTS } from '@/lib/lms/constants';

const VALID_MODES = ['online', 'offline', 'either'] as const;

function serialize(r: typeof sessionRequests.$inferSelect) {
  return {
    id:              r.id,
    userId:          r.userId,
    subject:         r.subject,
    topic:           r.topic,
    preferredMode:   r.preferredMode,
    durationMinutes: r.durationMinutes,
    notes:           r.notes,
    status:          r.status,
    resolvedSlotId:  r.resolvedSlotId,
    staffNote:       r.staffNote,
    createdAt:       r.createdAt.getTime(),
  };
}

export async function GET(_req: NextRequest) {
  return safeApiHandler(async () => {
    const me = await requireUser();

    const isStaff = me.role === 'admin' || me.role === 'super_admin' || me.role === 'instructor';
    if (!isStaff && me.products.length === 0) {
      throw new ApiException('LMS access required', 403, 'LMS_ACCESS_DENIED');
    }

    const rows = await db
      .select()
      .from(sessionRequests)
      .where(eq(sessionRequests.userId, me.id))
      .orderBy(desc(sessionRequests.createdAt));

    return rows.map(serialize);
  });
}

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const me = await requireUser();

    const isStaff = me.role === 'admin' || me.role === 'super_admin' || me.role === 'instructor';
    if (!isStaff && me.products.length === 0) {
      throw new ApiException('LMS access required', 403, 'LMS_ACCESS_DENIED');
    }

    const body = await req.json() as {
      subject?: string;
      topic?: string;
      preferredMode?: string;
      durationMinutes?: number;
      notes?: string;
    };

    const { subject, topic, preferredMode, durationMinutes, notes } = body;

    if (!subject || !(LMS_SUBJECTS as readonly string[]).includes(subject)) {
      throw new ApiException(`subject must be one of: ${LMS_SUBJECTS.join(', ')}`, 400);
    }
    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      throw new ApiException('topic is required', 400);
    }
    if (!preferredMode || !(VALID_MODES as readonly string[]).includes(preferredMode)) {
      throw new ApiException('preferredMode must be online, offline, or either', 400);
    }
    if (
      typeof durationMinutes !== 'number' ||
      durationMinutes < 15 ||
      durationMinutes > 120
    ) {
      throw new ApiException('durationMinutes must be between 15 and 120', 400);
    }

    const [created] = await db
      .insert(sessionRequests)
      .values({
        userId:          me.id,
        subject,
        product:         me.products[0] ?? 'iba',
        batch:           me.batch ?? null,
        topic:           topic.trim(),
        preferredMode,
        durationMinutes,
        notes:           notes?.trim() ?? null,
        status:          'pending',
      })
      .returning();

    return serialize(created);
  });
}

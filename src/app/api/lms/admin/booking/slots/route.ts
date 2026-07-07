/**
 * GET  /api/lms/admin/booking/slots — list all slots (newest first)
 * POST /api/lms/admin/booking/slots — create a new open slot
 */

import { NextRequest } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { bookingSlots, users } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { createMeetEvent, getHostClient } from '@/lib/google/calendar';
import { eq } from 'drizzle-orm';
import { LMS_SUBJECTS } from '@/lib/lms/constants';
import { isMeetAutoCreateEnabled } from '@/lib/lms/settings';

export async function GET(_req: NextRequest) {
  return safeApiHandler(async () => {
    await requireStaff();

    // We need two different joins to users — one for instructor, one for bookedBy.
    // Drizzle doesn't support multiple aliases cleanly in one join without raw SQL,
    // so we fetch all slots then look up names separately.
    const slots = await db
      .select()
      .from(bookingSlots)
      .orderBy(desc(bookingSlots.startAt));

    if (slots.length === 0) return [];

    // Collect all unique user ids
    const userIds = new Set<number>();
    slots.forEach((s) => {
      userIds.add(s.instructorId);
      if (s.bookedByUserId) userIds.add(s.bookedByUserId);
    });

    const userRows = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(
        userIds.size === 1
          ? eq(users.id, [...userIds][0])
          : undefined,
      );

    // Fallback: fetch individually or use a map from all users fetched above
    // For simplicity, fetch all referenced users
    const allNeededUsers = await db.select({ id: users.id, name: users.name }).from(users);
    const nameMap = new Map(allNeededUsers.map((u) => [u.id, u.name]));

    return slots.map((slot) => ({
      id:             slot.id,
      instructorId:   slot.instructorId,
      instructorName: nameMap.get(slot.instructorId) ?? 'Unknown',
      subject:        slot.subject,
      product:        slot.product,
      batch:          slot.batch,
      startAt:        slot.startAt.getTime(),
      endAt:          slot.endAt.getTime(),
      mode:           slot.mode,
      topic:          slot.topic,
      status:         slot.status,
      meetLink:       slot.meetLink,
      googleEventId:  slot.googleEventId,
      bookedByUserId: slot.bookedByUserId,
      bookedByName:   slot.bookedByUserId ? (nameMap.get(slot.bookedByUserId) ?? null) : null,
      bookedAt:       slot.bookedAt ? slot.bookedAt.getTime() : null,
      createdAt:      slot.createdAt.getTime(),
    }));
  });
}

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const staff = await requireStaff();
    const body = await req.json() as {
      startAt?: string;
      endAt?: string;
      mode?: string;
      topic?: string;
      subject?: string;
      product?: string;
      batch?: string;
    };

    const { startAt, endAt, mode, topic, subject, product, batch } = body;

    if (!startAt) throw new ApiException('startAt is required', 400);
    if (!endAt)   throw new ApiException('endAt is required', 400);

    const startDate = new Date(startAt);
    const endDate   = new Date(endAt);
    if (isNaN(startDate.getTime())) throw new ApiException('startAt must be a valid date', 400);
    if (isNaN(endDate.getTime()))   throw new ApiException('endAt must be a valid date', 400);
    if (endDate <= startDate)       throw new ApiException('endAt must be after startAt', 400);

    if (!mode || !['online', 'offline'].includes(mode)) {
      throw new ApiException('mode must be online or offline', 400);
    }

    const resolvedSubject = subject && (LMS_SUBJECTS as readonly string[]).includes(subject)
      ? subject : 'english';

    const [created] = await db
      .insert(bookingSlots)
      .values({
        instructorId: staff.id,
        subject:      resolvedSubject,
        product:      product ?? 'iba',
        batch:        batch ?? null,
        startAt:      startDate,
        endAt:        endDate,
        mode,
        topic:        topic?.trim() ?? null,
        status:       'open',
      })
      .returning();

    // For online slots: try to create a Meet event (when auto-create is enabled)
    let calendarWarning: string | undefined;

    if (mode === 'online' && await isMeetAutoCreateEnabled()) {
      try {
        const hostClient = await getHostClient();
        if (hostClient) {
          const meetResult = await createMeetEvent({
            title:    topic?.trim() ?? 'Doubt session',
            startISO: startDate.toISOString(),
            endISO:   endDate.toISOString(),
          });

          if (meetResult) {
            await db
              .update(bookingSlots)
              .set({ meetLink: meetResult.meetLink, googleEventId: meetResult.eventId })
              .where(eq(bookingSlots.id, created.id));

            created.meetLink      = meetResult.meetLink;
            created.googleEventId = meetResult.eventId;
          }
        }
      } catch (err) {
        console.error('[LMS] Meet event creation failed for slot (non-fatal):', err);
        calendarWarning = 'Google Calendar Meet could not be created. You can add a link manually.';
      }
    }

    const result = {
      id:             created.id,
      instructorId:   created.instructorId,
      instructorName: staff.name,
      subject:        created.subject,
      product:        created.product,
      batch:          created.batch,
      startAt:        created.startAt.getTime(),
      endAt:          created.endAt.getTime(),
      mode:           created.mode,
      topic:          created.topic,
      status:         created.status,
      meetLink:       created.meetLink,
      googleEventId:  created.googleEventId,
      bookedByUserId: null,
      bookedByName:   null,
      bookedAt:       null,
      createdAt:      created.createdAt.getTime(),
    };

    return calendarWarning ? { ...result, calendarWarning } : result;
  });
}

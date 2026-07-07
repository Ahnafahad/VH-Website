/**
 * POST /api/lms/booking/slots/[id]/book
 * Atomic slot claim — prevents double-booking via rowsAffected check.
 * If online + no meetLink → createMeetEvent best-effort.
 */

import { NextRequest } from 'next/server';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { bookingSlots } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { createMeetEvent, getHostClient } from '@/lib/google/calendar';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    const me = await requireUser();
    const { id } = await params;
    const slotId = Number(id);
    if (isNaN(slotId)) throw new ApiException('Invalid slot id', 400);

    const isStaff =
      me.role === 'admin' || me.role === 'super_admin' || me.role === 'instructor';
    if (!isStaff && me.products.length === 0) {
      throw new ApiException('LMS access required', 403, 'LMS_ACCESS_DENIED');
    }

    const now = new Date();

    // Read the slot first to validate
    const [slot] = await db
      .select()
      .from(bookingSlots)
      .where(eq(bookingSlots.id, slotId))
      .limit(1);

    if (!slot) throw new ApiException('Slot not found', 404, 'SLOT_NOT_FOUND');
    if (slot.status !== 'open') throw new ApiException('Slot is not available', 409, 'SLOT_TAKEN');
    if (slot.startAt <= now) throw new ApiException('Slot is in the past', 409, 'SLOT_PAST');

    // Atomic claim: UPDATE ... WHERE id=? AND status='open'
    // Check rowsAffected to prevent race conditions
    const result = await db
      .update(bookingSlots)
      .set({
        status:         'booked',
        bookedByUserId: me.id,
        bookedAt:       now,
      })
      .where(
        and(
          eq(bookingSlots.id, slotId),
          eq(bookingSlots.status, 'open'),  // <-- race-condition guard
          gt(bookingSlots.startAt, now),
        ),
      );

    // Drizzle returns { rowsAffected: number } for libSQL
    const affected = (result as unknown as { rowsAffected: number }).rowsAffected ?? 1;
    if (affected === 0) {
      throw new ApiException('Slot was just taken by someone else', 409, 'SLOT_TAKEN');
    }

    // If online and no meetLink, try to create Google Meet
    let meetWarning: string | undefined;

    if (slot.mode === 'online' && !slot.meetLink) {
      try {
        const hostClient = await getHostClient();
        if (hostClient) {
          const meetResult = await createMeetEvent({
            title:           slot.topic ?? 'Doubt session',
            startISO:        slot.startAt.toISOString(),
            endISO:          slot.endAt.toISOString(),
            attendeeEmails:  [me.email],
          });

          if (meetResult) {
            await db
              .update(bookingSlots)
              .set({
                meetLink:      meetResult.meetLink,
                googleEventId: meetResult.eventId,
              })
              .where(eq(bookingSlots.id, slotId));

            slot.meetLink      = meetResult.meetLink;
            slot.googleEventId = meetResult.eventId;
          }
        }
      } catch (err) {
        console.error('[LMS] Meet event creation failed (non-fatal):', err);
        meetWarning = 'Meet link could not be generated automatically. Your instructor will share it.';
      }
    }

    const updated = { ...slot, status: 'booked', bookedByUserId: me.id, bookedAt: now };

    const response = {
      id:             updated.id,
      instructorId:   updated.instructorId,
      startAt:        updated.startAt.getTime(),
      endAt:          updated.endAt.getTime(),
      mode:           updated.mode,
      topic:          updated.topic,
      status:         'booked',
      meetLink:       updated.meetLink,
      bookedByUserId: updated.bookedByUserId,
      bookedAt:       updated.bookedAt ? (updated.bookedAt as Date).getTime() : now.getTime(),
    };

    return meetWarning ? { ...response, meetWarning } : response;
  });
}

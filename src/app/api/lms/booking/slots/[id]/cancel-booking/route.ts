/**
 * POST /api/lms/booking/slots/[id]/cancel-booking
 * Student cancels their own booking. Must be:
 *   - their booking
 *   - future slot
 *   - > 2h before startAt
 * Reverts slot to 'open'; clears bookedBy; best-effort deleteMeetEvent.
 */

import { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { bookingSlots } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { deleteMeetEvent } from '@/lib/google/calendar';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    const me = await requireUser();
    const { id } = await params;
    const slotId = Number(id);
    if (isNaN(slotId)) throw new ApiException('Invalid slot id', 400);

    const [slot] = await db
      .select()
      .from(bookingSlots)
      .where(eq(bookingSlots.id, slotId))
      .limit(1);

    if (!slot) throw new ApiException('Slot not found', 404, 'SLOT_NOT_FOUND');
    if (slot.bookedByUserId !== me.id) {
      throw new ApiException('This is not your booking', 403, 'NOT_YOUR_BOOKING');
    }
    if (slot.status !== 'booked') {
      throw new ApiException('Slot is not in booked state', 409, 'NOT_BOOKED');
    }

    const now = new Date();
    if (slot.startAt <= now) {
      throw new ApiException('Cannot cancel a past slot', 409, 'SLOT_PAST');
    }
    if (slot.startAt.getTime() - now.getTime() < TWO_HOURS_MS) {
      throw new ApiException('Cannot cancel within 2 hours of the slot', 409, 'TOO_LATE_TO_CANCEL');
    }

    // Revert to open
    const googleEventId = slot.googleEventId;

    await db
      .update(bookingSlots)
      .set({
        status:         'open',
        bookedByUserId: null,
        bookedAt:       null,
        meetLink:       null,
        googleEventId:  null,
      })
      .where(eq(bookingSlots.id, slotId));

    // Best-effort: delete the Meet event
    if (googleEventId) {
      try {
        await deleteMeetEvent(googleEventId);
      } catch (err) {
        console.warn('[LMS] deleteMeetEvent failed (non-fatal):', err);
      }
    }

    return { success: true };
  });
}

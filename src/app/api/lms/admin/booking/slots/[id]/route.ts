/**
 * PATCH /api/lms/admin/booking/slots/[id] — update slot (topic, mode, times)
 * DELETE /api/lms/admin/booking/slots/[id] — cancel slot (status='cancelled')
 *   If booked: response includes bookedByEmail so instructor can inform student.
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { bookingSlots, users } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { deleteMeetEvent } from '@/lib/google/calendar';

async function getSlot(id: number) {
  const [slot] = await db
    .select()
    .from(bookingSlots)
    .where(eq(bookingSlots.id, id))
    .limit(1);
  return slot ?? null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    await requireStaff();
    const { id } = await params;
    const slotId = Number(id);
    if (isNaN(slotId)) throw new ApiException('Invalid slot id', 400);

    const slot = await getSlot(slotId);
    if (!slot) throw new ApiException('Slot not found', 404, 'SLOT_NOT_FOUND');
    if (slot.status === 'cancelled') throw new ApiException('Cannot modify a cancelled slot', 400);

    const body = await req.json() as {
      startAt?: string;
      endAt?: string;
      mode?: string;
      topic?: string;
    };

    const patch: Partial<typeof bookingSlots.$inferInsert> = {};

    if (body.startAt) {
      const d = new Date(body.startAt);
      if (isNaN(d.getTime())) throw new ApiException('startAt invalid', 400);
      patch.startAt = d;
    }
    if (body.endAt) {
      const d = new Date(body.endAt);
      if (isNaN(d.getTime())) throw new ApiException('endAt invalid', 400);
      patch.endAt = d;
    }
    if (body.mode && ['online', 'offline'].includes(body.mode)) {
      patch.mode = body.mode;
    }
    if (body.topic !== undefined) {
      patch.topic = body.topic?.trim() ?? null;
    }

    if (Object.keys(patch).length === 0) throw new ApiException('No valid fields to update', 400);

    await db.update(bookingSlots).set(patch).where(eq(bookingSlots.id, slotId));

    return { success: true };
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    await requireStaff();
    const { id } = await params;
    const slotId = Number(id);
    if (isNaN(slotId)) throw new ApiException('Invalid slot id', 400);

    const slot = await getSlot(slotId);
    if (!slot) throw new ApiException('Slot not found', 404, 'SLOT_NOT_FOUND');
    if (slot.status === 'cancelled') return { success: true, alreadyCancelled: true };

    // If booked, get student email for instructor to inform
    let bookedByEmail: string | null = null;
    if (slot.bookedByUserId) {
      const [u] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, slot.bookedByUserId))
        .limit(1);
      bookedByEmail = u?.email ?? null;
    }

    const googleEventId = slot.googleEventId;

    await db
      .update(bookingSlots)
      .set({ status: 'cancelled' })
      .where(eq(bookingSlots.id, slotId));

    // Best-effort delete Calendar event
    if (googleEventId) {
      try {
        await deleteMeetEvent(googleEventId);
      } catch (err) {
        console.warn('[LMS] deleteMeetEvent failed (non-fatal):', err);
      }
    }

    return {
      success: true,
      wasBooked: slot.status === 'booked',
      bookedByEmail, // inform instructor if needed
    };
  });
}

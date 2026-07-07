/**
 * GET /api/lms/booking/slots
 * Returns:
 *   - open slots with startAt > now (any LMS student or staff can see)
 *   - my booked slots (status='booked' AND bookedByUserId=me, future)
 * Instructor name joined.
 */

import { NextRequest } from 'next/server';
import { and, eq, gt, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { bookingSlots, users } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';

export async function GET(_req: NextRequest) {
  return safeApiHandler(async () => {
    const me = await requireUser();

    // Staff always get through; students must have at least one product
    const isStaff =
      me.role === 'admin' || me.role === 'super_admin' || me.role === 'instructor';

    if (!isStaff && me.products.length === 0) {
      throw new ApiException('LMS access required', 403, 'LMS_ACCESS_DENIED');
    }

    const now = new Date();

    // Alias for instructor
    const instructor = {
      id:   users.id,
      name: users.name,
    };

    // Open slots in the future
    const openSlots = await db
      .select({
        slot: bookingSlots,
        instructorName: users.name,
      })
      .from(bookingSlots)
      .leftJoin(users, eq(bookingSlots.instructorId, users.id))
      .where(
        and(
          eq(bookingSlots.status, 'open'),
          gt(bookingSlots.startAt, now),
        ),
      );

    // My booked future slots
    const myBooked = await db
      .select({
        slot: bookingSlots,
        instructorName: users.name,
      })
      .from(bookingSlots)
      .leftJoin(users, eq(bookingSlots.instructorId, users.id))
      .where(
        and(
          eq(bookingSlots.status, 'booked'),
          eq(bookingSlots.bookedByUserId, me.id),
          gt(bookingSlots.startAt, now),
        ),
      );

    const serialize = (row: { slot: typeof bookingSlots.$inferSelect; instructorName: string | null }) => ({
      id:             row.slot.id,
      instructorId:   row.slot.instructorId,
      instructorName: row.instructorName ?? 'Instructor',
      subject:        row.slot.subject,
      product:        row.slot.product,
      batch:          row.slot.batch,
      startAt:        row.slot.startAt.getTime(),
      endAt:          row.slot.endAt.getTime(),
      mode:           row.slot.mode,
      topic:          row.slot.topic,
      status:         row.slot.status,
      meetLink:       row.slot.meetLink,
      bookedByUserId: row.slot.bookedByUserId,
      bookedAt:       row.slot.bookedAt ? row.slot.bookedAt.getTime() : null,
    });

    return {
      open:   openSlots.map(serialize),
      booked: myBooked.map(serialize),
    };
  });
}

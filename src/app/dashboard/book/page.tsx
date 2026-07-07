/**
 * /dashboard/book — Student session booking page.
 * Server component: auth guard → fetch open slots + my requests → render client.
 */

import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { and, eq, gt, or } from 'drizzle-orm';
import { authOptions } from '@/lib/auth';
import { getUserByEmail } from '@/lib/db-access-control';
import { db } from '@/lib/db';
import { bookingSlots, sessionRequests, users } from '@/lib/db/schema';
import BookingClient from '@/components/lms/BookingClient';

export const metadata = { title: 'Book a Session — VH' };

export default async function BookPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');

  const user = await getUserByEmail(session.user.email);
  if (!user) redirect('/auth/signin');

  const isStaff =
    user.role === 'admin' || user.role === 'super_admin' || user.role === 'instructor';

  // Students need at least one product to access LMS
  if (!isStaff && user.products.length === 0) redirect('/dashboard');

  const now = new Date();

  // Open slots (future)
  const openSlotsRaw = await db
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
  const myBookedRaw = await db
    .select({
      slot: bookingSlots,
      instructorName: users.name,
    })
    .from(bookingSlots)
    .leftJoin(users, eq(bookingSlots.instructorId, users.id))
    .where(
      and(
        eq(bookingSlots.status, 'booked'),
        eq(bookingSlots.bookedByUserId, user.id),
        gt(bookingSlots.startAt, now),
      ),
    );

  // My session requests
  const myRequests = await db
    .select()
    .from(sessionRequests)
    .where(eq(sessionRequests.userId, user.id))
    .orderBy(sessionRequests.createdAt);

  function serializeSlot(row: { slot: typeof bookingSlots.$inferSelect; instructorName: string | null }) {
    return {
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
    };
  }

  return (
    <BookingClient
      openSlots={openSlotsRaw.map(serializeSlot)}
      bookedSlots={myBookedRaw.map(serializeSlot)}
      myRequests={myRequests.map((r) => ({
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
      }))}
    />
  );
}

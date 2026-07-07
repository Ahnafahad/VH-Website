/**
 * /admin/bookings — Instructor bookings management.
 * Server component: staff auth guard → fetch slots + requests → render client.
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { desc } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { bookingSlots, sessionRequests, users } from '@/lib/db/schema';
import BookingsClient from '@/components/admin/lms/BookingsClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bookings | Admin' };

export default async function BookingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');

  // Fetch slots with instructor name joined
  const slotsRaw = await db
    .select({
      slot: bookingSlots,
      instructorName: users.name,
      bookedByName: users.name,
    })
    .from(bookingSlots)
    .leftJoin(users, eq(bookingSlots.instructorId, users.id))
    .orderBy(desc(bookingSlots.startAt));

  // Need a second join for bookedByUser — do it separately to avoid alias confusion
  const slotsWithBooker = await Promise.all(
    slotsRaw.map(async (row) => {
      let bookedByName: string | null = null;
      if (row.slot.bookedByUserId) {
        const booker = await db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, row.slot.bookedByUserId))
          .get();
        bookedByName = booker?.name ?? null;
      }
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
        bookedByName,
        bookedAt:       row.slot.bookedAt ? row.slot.bookedAt.getTime() : null,
        createdAt:      row.slot.createdAt.getTime(),
      };
    }),
  );

  // Fetch requests with student info joined
  const requestsRaw = await db
    .select({
      req: sessionRequests,
      userName: users.name,
      userEmail: users.email,
    })
    .from(sessionRequests)
    .innerJoin(users, eq(sessionRequests.userId, users.id))
    .orderBy(desc(sessionRequests.createdAt));

  const initialRequests = requestsRaw.map((row) => ({
    id:              row.req.id,
    userId:          row.req.userId,
    userName:        row.userName,
    userEmail:       row.userEmail,
    subject:         row.req.subject,
    topic:           row.req.topic,
    preferredMode:   row.req.preferredMode,
    durationMinutes: row.req.durationMinutes,
    notes:           row.req.notes,
    status:          row.req.status,
    resolvedSlotId:  row.req.resolvedSlotId,
    staffNote:       row.req.staffNote,
    createdAt:       row.req.createdAt.getTime(),
  }));

  return (
    <BookingsClient
      initialSlots={slotsWithBooker}
      initialRequests={initialRequests}
    />
  );
}

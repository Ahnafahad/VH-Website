/**
 * POST /api/lms/admin/booking/requests/[id]/resolve
 * Body: { action: 'approve' | 'decline' | 'schedule', staffNote?, slot? }
 *
 * approve  → status='approved' + staffNote
 * decline  → status='declined' + staffNote
 * schedule → creates a pre-booked slot for the requester,
 *             sets request status='scheduled' + resolvedSlotId
 *             online → createMeetEvent w/ student attendee (failure-tolerant)
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { sessionRequests, bookingSlots, users } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { createMeetEvent, getHostClient } from '@/lib/google/calendar';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    const staff = await requireStaff();
    const { id } = await params;
    const requestId = Number(id);
    if (isNaN(requestId)) throw new ApiException('Invalid request id', 400);

    const [request] = await db
      .select()
      .from(sessionRequests)
      .where(eq(sessionRequests.id, requestId))
      .limit(1);

    if (!request) throw new ApiException('Request not found', 404, 'REQUEST_NOT_FOUND');
    if (request.status !== 'pending') {
      throw new ApiException(`Request is already ${request.status}`, 409, 'ALREADY_RESOLVED');
    }

    const body = await req.json() as {
      action?: string;
      staffNote?: string;
      slot?: {
        startAt: string;
        endAt: string;
        mode: string;
      };
    };

    const { action, staffNote, slot } = body;

    if (!action || !['approve', 'decline', 'schedule'].includes(action)) {
      throw new ApiException('action must be approve, decline, or schedule', 400);
    }

    // ── approve / decline ────────────────────────────────────────────────────
    if (action === 'approve' || action === 'decline') {
      await db
        .update(sessionRequests)
        .set({
          status:    action === 'approve' ? 'approved' : 'declined',
          staffNote: staffNote?.trim() ?? null,
        })
        .where(eq(sessionRequests.id, requestId));

      return { success: true, status: action === 'approve' ? 'approved' : 'declined' };
    }

    // ── schedule ─────────────────────────────────────────────────────────────
    if (!slot?.startAt || !slot?.endAt) {
      throw new ApiException('slot.startAt and slot.endAt are required for schedule action', 400);
    }
    if (!slot.mode || !['online', 'offline'].includes(slot.mode)) {
      throw new ApiException('slot.mode must be online or offline', 400);
    }

    const startDate = new Date(slot.startAt);
    const endDate   = new Date(slot.endAt);
    if (isNaN(startDate.getTime())) throw new ApiException('slot.startAt invalid', 400);
    if (isNaN(endDate.getTime()))   throw new ApiException('slot.endAt invalid', 400);
    if (endDate <= startDate)       throw new ApiException('slot.endAt must be after slot.startAt', 400);

    // Get student email for meet invite
    const [student] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, request.userId))
      .limit(1);

    const studentEmail = student?.email ?? null;

    // Create the slot (pre-booked)
    const [createdSlot] = await db
      .insert(bookingSlots)
      .values({
        instructorId:   staff.id,
        subject:        request.subject,
        product:        request.product,
        batch:          request.batch,
        startAt:        startDate,
        endAt:          endDate,
        mode:           slot.mode,
        topic:          request.topic,
        status:         'booked',
        bookedByUserId: request.userId,
        bookedAt:       new Date(),
      })
      .returning();

    // For online: try to create Meet event
    let meetWarning: string | undefined;

    if (slot.mode === 'online') {
      try {
        const hostClient = await getHostClient();
        if (hostClient) {
          const meetResult = await createMeetEvent({
            title:           request.topic,
            startISO:        startDate.toISOString(),
            endISO:          endDate.toISOString(),
            attendeeEmails:  studentEmail ? [studentEmail] : [],
          });

          if (meetResult) {
            await db
              .update(bookingSlots)
              .set({ meetLink: meetResult.meetLink, googleEventId: meetResult.eventId })
              .where(eq(bookingSlots.id, createdSlot.id));

            createdSlot.meetLink      = meetResult.meetLink;
            createdSlot.googleEventId = meetResult.eventId;
          }
        }
      } catch (err) {
        console.error('[LMS] Meet creation for scheduled request failed (non-fatal):', err);
        meetWarning = 'Google Meet could not be created automatically.';
      }
    }

    // Update the session request
    await db
      .update(sessionRequests)
      .set({
        status:         'scheduled',
        resolvedSlotId: createdSlot.id,
        staffNote:      staffNote?.trim() ?? null,
      })
      .where(eq(sessionRequests.id, requestId));

    const result = {
      success:  true,
      status:   'scheduled',
      slotId:   createdSlot.id,
      meetLink: createdSlot.meetLink,
    };

    return meetWarning ? { ...result, meetWarning } : result;
  });
}

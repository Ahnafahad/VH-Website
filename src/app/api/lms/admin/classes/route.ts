/**
 * GET  /api/lms/admin/classes — list sessions (optional ?from&to&status)
 * POST /api/lms/admin/classes — create a session manually
 */

import { NextRequest } from 'next/server';
import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { classSessions } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { LMS_SUBJECTS } from '@/lib/lms/constants';
import { asc } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { createMeetEvent } from '@/lib/google/calendar';
import { getAttendeeEmails } from '@/lib/lms/attendees';
import { isMeetAutoCreateEnabled } from '@/lib/lms/settings';
import { getRecordingProvider } from '@/lib/recording/recall';
import { recordings } from '@/lib/db/schema';

export async function GET(req: NextRequest) {
  return safeApiHandler(async () => {
    await requireStaff();
    const url = new URL(req.url);

    const conditions: SQL[] = [];

    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const status = url.searchParams.get('status');

    if (from) {
      const d = new Date(from);
      if (isNaN(d.getTime())) throw new ApiException('Invalid from date', 400);
      conditions.push(gte(classSessions.scheduledAt, d));
    }
    if (to) {
      const d = new Date(to);
      if (isNaN(d.getTime())) throw new ApiException('Invalid to date', 400);
      conditions.push(lte(classSessions.scheduledAt, d));
    }
    if (status) {
      conditions.push(eq(classSessions.status, status));
    }

    const rows = await db
      .select()
      .from(classSessions)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(classSessions.scheduledAt));

    return rows.map(serializeSession);
  });
}

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const staff = await requireStaff();
    const body = await req.json();

    const { title, description, subject, product, batch, scheduledAt, durationMinutes, meetLink, status } = body;

    if (!title || typeof title !== 'string') throw new ApiException('title is required', 400);
    if (!subject || !(LMS_SUBJECTS as readonly string[]).includes(subject)) {
      throw new ApiException(`subject must be one of: ${LMS_SUBJECTS.join(', ')}`, 400);
    }
    if (!product || typeof product !== 'string') throw new ApiException('product is required', 400);
    if (!scheduledAt) throw new ApiException('scheduledAt is required', 400);
    const scheduledAtDate = new Date(scheduledAt);
    if (isNaN(scheduledAtDate.getTime())) throw new ApiException('scheduledAt must be a valid date', 400);
    if (typeof durationMinutes !== 'number' || durationMinutes < 1) {
      throw new ApiException('durationMinutes must be a positive number', 400);
    }

    const validStatuses = ['draft', 'scheduled', 'live', 'completed', 'cancelled'];
    const sessionStatus = status && validStatuses.includes(status) ? status : 'scheduled';

    const [created] = await db
      .insert(classSessions)
      .values({
        title,
        description: description ?? null,
        subject,
        product,
        batch: batch ?? null,
        scheduledAt: scheduledAtDate,
        durationMinutes,
        status: sessionStatus,
        meetLink: meetLink ?? null,
        googleEventId: null,
        recallBotId: null,
        createdBy: staff.id,
      })
      .returning();

    // ── Auto-create Google Meet event (non-blocking, failure-tolerant) ─────────
    let calendarWarning: string | undefined;

    if (!meetLink && sessionStatus === 'scheduled' && await isMeetAutoCreateEnabled()) {
      try {
        const endDate = new Date(scheduledAtDate.getTime() + durationMinutes * 60_000);
        const attendeeEmails = await getAttendeeEmails({ product, batch: batch ?? null });

        const meetResult = await createMeetEvent({
          title,
          description: description ?? undefined,
          startISO: scheduledAtDate.toISOString(),
          endISO:   endDate.toISOString(),
          attendeeEmails,
        });

        if (meetResult) {
          // Save meet link and event id back to the row
          await db
            .update(classSessions)
            .set({ meetLink: meetResult.meetLink, googleEventId: meetResult.eventId })
            .where(eq(classSessions.id, created.id));

          created.meetLink      = meetResult.meetLink;
          created.googleEventId = meetResult.eventId;
        }
      } catch (err) {
        console.error('[LMS] Google Calendar event creation failed (non-fatal):', err);
        calendarWarning = 'Google Calendar event could not be created. You can paste the Meet link manually.';
      }
    }

    // ── Auto-schedule Recall.ai recording bot (non-blocking, failure-tolerant) ─
    let recordingWarning: string | undefined;
    const resolvedMeetLink = created.meetLink;

    if (resolvedMeetLink && sessionStatus === 'scheduled') {
      try {
        const provider = getRecordingProvider();
        if (provider) {
          const { botId } = await provider.scheduleBot({
            meetingUrl: resolvedMeetLink,
            joinAt: scheduledAtDate,
          });

          await db
            .update(classSessions)
            .set({ recallBotId: botId })
            .where(eq(classSessions.id, created.id));
          created.recallBotId = botId;

          // Create the recordings row with status='pending'
          await db.insert(recordings).values({
            classSessionId: created.id,
            r2Key: `recordings/${created.id}.mp4`,
            status: 'pending',
            source: 'recall',
          });
        }
      } catch (err) {
        console.error('[LMS] Recall.ai bot scheduling failed (non-fatal):', err);
        recordingWarning = 'Recording bot could not be scheduled. You can retry from the class detail page.';
      }
    }

    const result = serializeSession(created);
    const warnings: Record<string, string> = {};
    if (calendarWarning) warnings.calendarWarning = calendarWarning;
    if (recordingWarning) warnings.recordingWarning = recordingWarning;
    return Object.keys(warnings).length > 0 ? { ...result, ...warnings } : result;
  });
}

function serializeSession(s: typeof classSessions.$inferSelect) {
  return {
    id: s.id,
    scheduleId: s.scheduleId,
    title: s.title,
    description: s.description,
    subject: s.subject,
    product: s.product,
    batch: s.batch,
    scheduledAt: s.scheduledAt.getTime(),
    durationMinutes: s.durationMinutes,
    status: s.status,
    meetLink: s.meetLink,
    googleEventId: s.googleEventId,
    recallBotId: s.recallBotId,
    createdBy: s.createdBy,
    createdAt: s.createdAt.getTime(),
  };
}

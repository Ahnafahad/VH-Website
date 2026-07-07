/**
 * PATCH  /api/lms/admin/classes/[id] — update a session
 * DELETE /api/lms/admin/classes/[id] — soft-delete (cancelled) or hard-delete
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { classSessions, classAttendance, recordings } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { LMS_SUBJECTS } from '@/lib/lms/constants';
import { updateMeetEvent, deleteMeetEvent } from '@/lib/google/calendar';
import { getRecordingProvider } from '@/lib/recording/recall';
import { isMeetAutoCreateEnabled } from '@/lib/lms/settings';

const VALID_STATUSES = ['draft', 'scheduled', 'live', 'completed', 'cancelled'] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    await requireStaff();
    const { id } = await params;
    const sessionId = parseInt(id, 10);
    if (isNaN(sessionId)) throw new ApiException('Invalid id', 400);

    const existing = await db
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, sessionId))
      .get();
    if (!existing) throw new ApiException('Session not found', 404);

    const body = await req.json();
    const updates: Partial<typeof classSessions.$inferInsert> = {};

    if (body.title !== undefined) {
      if (typeof body.title !== 'string') throw new ApiException('title must be a string', 400);
      updates.title = body.title;
    }
    if (body.description !== undefined) updates.description = body.description ?? null;
    if (body.subject !== undefined) {
      if (!(LMS_SUBJECTS as readonly string[]).includes(body.subject)) {
        throw new ApiException(`subject must be one of: ${LMS_SUBJECTS.join(', ')}`, 400);
      }
      updates.subject = body.subject;
    }
    if (body.product !== undefined) updates.product = body.product;
    if (body.batch !== undefined) updates.batch = body.batch ?? null;
    if (body.scheduledAt !== undefined) {
      const d = new Date(body.scheduledAt);
      if (isNaN(d.getTime())) throw new ApiException('scheduledAt must be a valid date', 400);
      updates.scheduledAt = d;
    }
    if (body.durationMinutes !== undefined) {
      if (typeof body.durationMinutes !== 'number' || body.durationMinutes < 1) {
        throw new ApiException('durationMinutes must be a positive number', 400);
      }
      updates.durationMinutes = body.durationMinutes;
    }
    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        throw new ApiException(`status must be one of: ${VALID_STATUSES.join(', ')}`, 400);
      }
      updates.status = body.status;
    }
    if (body.meetLink !== undefined) updates.meetLink = body.meetLink ?? null;

    if (Object.keys(updates).length === 0) throw new ApiException('No fields to update', 400);

    const [updated] = await db
      .update(classSessions)
      .set(updates)
      .where(eq(classSessions.id, sessionId))
      .returning();

    // ── Sync Google Calendar event (failure-tolerant) ─────────────────────────
    let calendarWarning: string | undefined;

    if (existing.googleEventId) {
      const timeChanged = (
        body.scheduledAt !== undefined ||
        body.durationMinutes !== undefined
      );
      const titleChanged = body.title !== undefined;

      if (updates.status === 'cancelled') {
        // Delete the calendar event when class is cancelled
        try {
          await deleteMeetEvent(existing.googleEventId);
          // Clear googleEventId on the row
          await db
            .update(classSessions)
            .set({ googleEventId: null })
            .where(eq(classSessions.id, sessionId));
          updated.googleEventId = null;
        } catch (err) {
          console.error('[LMS] Google Calendar event deletion failed (non-fatal):', err);
          calendarWarning = 'Google Calendar event could not be deleted. Please remove it manually.';
        }
      } else if ((timeChanged || titleChanged) && await isMeetAutoCreateEnabled()) {
        // Patch the calendar event when schedule or title changed (only when auto-create is on)
        try {
          const resolvedStart = updates.scheduledAt ?? existing.scheduledAt;
          const resolvedDuration = updates.durationMinutes ?? existing.durationMinutes;
          const resolvedTitle = updates.title ?? existing.title;

          const startISO = resolvedStart.toISOString();
          const endISO   = new Date(resolvedStart.getTime() + resolvedDuration * 60_000).toISOString();

          await updateMeetEvent(existing.googleEventId, {
            ...(titleChanged ? { title: resolvedTitle } : {}),
            ...(timeChanged  ? { startISO, endISO }     : {}),
          });
        } catch (err) {
          console.error('[LMS] Google Calendar event update failed (non-fatal):', err);
          calendarWarning = 'Google Calendar event could not be updated. Please update it manually.';
        }
      }
    }

    // ── Sync Recall.ai bot (failure-tolerant) ────────────────────────────────
    let recordingWarning: string | undefined;
    const provider = getRecordingProvider();

    if (provider && existing.recallBotId) {
      const timeChanged  = body.scheduledAt  !== undefined || body.durationMinutes !== undefined;
      const linkChanged  = body.meetLink     !== undefined;
      const isCancelled  = updates.status === 'cancelled';

      if (isCancelled) {
        try {
          await provider.cancelBot(existing.recallBotId);
          // Mark the recordings row as failed
          await db
            .update(recordings)
            .set({ status: 'failed', errorMessage: 'class cancelled' })
            .where(eq(recordings.classSessionId, sessionId));
          await db
            .update(classSessions)
            .set({ recallBotId: null })
            .where(eq(classSessions.id, sessionId));
          updated.recallBotId = null;
        } catch (err) {
          console.error('[LMS] Recall.ai bot cancellation failed (non-fatal):', err);
          recordingWarning = 'Recording bot could not be cancelled. Please cancel it manually in Recall.ai.';
        }
      } else if (timeChanged || linkChanged) {
        try {
          const resolvedMeetLink = updates.meetLink ?? existing.meetLink;
          const resolvedAt =
            updates.scheduledAt ?? existing.scheduledAt;

          if (resolvedMeetLink) {
            const { botId } = await provider.rescheduleBot(existing.recallBotId, {
              meetingUrl: resolvedMeetLink,
              joinAt: resolvedAt,
            });
            await db
              .update(classSessions)
              .set({ recallBotId: botId })
              .where(eq(classSessions.id, sessionId));
            updated.recallBotId = botId;
          }
        } catch (err) {
          console.error('[LMS] Recall.ai bot reschedule failed (non-fatal):', err);
          recordingWarning = 'Recording bot could not be rescheduled. The bot may use the old meeting time.';
        }
      }
    } else if (provider && !existing.recallBotId && updates.status === 'scheduled') {
      // Status just set to 'scheduled' and no bot yet — schedule one if we have a meet link
      const resolvedMeetLink = updates.meetLink ?? existing.meetLink;
      if (resolvedMeetLink) {
        try {
          const resolvedAt = updates.scheduledAt ?? existing.scheduledAt;
          const { botId } = await provider.scheduleBot({
            meetingUrl: resolvedMeetLink,
            joinAt: resolvedAt,
          });
          await db
            .update(classSessions)
            .set({ recallBotId: botId })
            .where(eq(classSessions.id, sessionId));
          updated.recallBotId = botId;

          // Insert recordings row if one doesn't already exist
          const existingRec = await db
            .select({ id: recordings.id })
            .from(recordings)
            .where(eq(recordings.classSessionId, sessionId))
            .limit(1)
            .get();

          if (!existingRec) {
            await db.insert(recordings).values({
              classSessionId: sessionId,
              r2Key: `recordings/${sessionId}.mp4`,
              status: 'pending',
              source: 'recall',
            });
          }
        } catch (err) {
          console.error('[LMS] Recall.ai bot scheduling failed during PATCH (non-fatal):', err);
          recordingWarning = 'Recording bot could not be scheduled. You can retry from the class detail page.';
        }
      }
    }

    const result = serializeSession(updated);
    const warnings: Record<string, string> = {};
    if (calendarWarning) warnings.calendarWarning = calendarWarning;
    if (recordingWarning) warnings.recordingWarning = recordingWarning;
    return Object.keys(warnings).length > 0 ? { ...result, ...warnings } : result;
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    await requireStaff();
    const { id } = await params;
    const sessionId = parseInt(id, 10);
    if (isNaN(sessionId)) throw new ApiException('Invalid id', 400);

    const existing = await db
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, sessionId))
      .get();
    if (!existing) throw new ApiException('Session not found', 404);

    // Check whether related records exist (attendance or recording)
    const [attendanceRow, recordingRow] = await Promise.all([
      db
        .select({ id: classAttendance.id })
        .from(classAttendance)
        .where(eq(classAttendance.sessionId, sessionId))
        .limit(1)
        .get(),
      db
        .select({ id: recordings.id })
        .from(recordings)
        .where(eq(recordings.classSessionId, sessionId))
        .limit(1)
        .get(),
    ]);

    if (attendanceRow || recordingRow) {
      // Soft delete: mark as cancelled
      await db
        .update(classSessions)
        .set({ status: 'cancelled' })
        .where(eq(classSessions.id, sessionId));

      // Best-effort: delete Google Calendar event
      if (existing.googleEventId) {
        deleteMeetEvent(existing.googleEventId).catch((err) => {
          console.error('[LMS] Google Calendar event deletion failed (soft-delete):', err);
        });
      }

      // Best-effort: cancel Recall.ai bot
      if (existing.recallBotId) {
        const provider = getRecordingProvider();
        if (provider) {
          provider.cancelBot(existing.recallBotId).catch((err) => {
            console.error('[LMS] Recall.ai bot cancellation failed (soft-delete, non-fatal):', err);
          });
        }
      }

      return { deleted: false, cancelled: true };
    }

    // Best-effort: delete Google Calendar event before hard delete
    if (existing.googleEventId) {
      deleteMeetEvent(existing.googleEventId).catch((err) => {
        console.error('[LMS] Google Calendar event deletion failed (hard-delete):', err);
      });
    }

    // Best-effort: cancel Recall.ai bot before hard delete
    if (existing.recallBotId) {
      const provider = getRecordingProvider();
      if (provider) {
        provider.cancelBot(existing.recallBotId).catch((err) => {
          console.error('[LMS] Recall.ai bot cancellation failed (hard-delete, non-fatal):', err);
        });
      }
    }

    // Hard delete
    await db.delete(classSessions).where(eq(classSessions.id, sessionId));
    return { deleted: true, cancelled: false };
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

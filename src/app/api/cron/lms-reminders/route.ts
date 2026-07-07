/**
 * GET|POST /api/cron/lms-reminders
 *
 * Runs every 30 minutes (configured in vercel.json).
 * Four isolated checks:
 *   1. classSoon      — sessions starting within [now, now+45min], not yet notified
 *   2. hwDue          — assignments due within [now, now+24h], remind students without submissions
 *   3. recPublished   — recordings status='available' created/updated within last 24h, not notified
 *   4. recExpiring    — recordings with exactly 1 subsequent completed class (next class = expiry)
 *
 * Dedup via lms_settings key-value markers:
 *   notified:class_soon:{sessionId}
 *   notified:hw_due:{assignmentId}
 *   notified:rec_pub:{recordingId}
 *   notified:rec_exp:{recordingId}
 *
 * Supports ?dryRun=1 — returns planned sends without actually sending or setting markers.
 *
 * Protected by CRON_SECRET header (exactly like src/app/api/cron/check-streaks).
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gt, lt, inArray, notInArray, isNull, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  classSessions,
  assignments,
  assignmentSubmissions,
  recordings,
  users,
  userAccess,
} from '@/lib/db/schema';
import { getLmsSetting, setLmsSetting } from '@/lib/lms/settings';
import { getAttendeeEmails } from '@/lib/lms/attendees';
import { countSubsequentCompletedClasses } from '@/lib/lms/recording-expiry-db';
import {
  sendLmsClassSoon,
  sendLmsHomeworkDue,
  sendLmsRecordingPublished,
  sendLmsRecordingExpiring,
} from '@/lib/email';

const CRON_SECRET = process.env.CRON_SECRET;

// ─── Auth guard ──────────────────────────────────────────────────────────────

function checkSecret(req: NextRequest): NextResponse | null {
  if (!CRON_SECRET) {
    console.error('[lms-reminders] CRON_SECRET is not configured');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

// ─── Name resolver ────────────────────────────────────────────────────────────
// Reuse for per-recipient personalisation.

async function getUserName(email: string): Promise<string> {
  const row = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.email, email))
    .get();
  return row?.name ?? 'there';
}

// ─── Check 1: Class starting soon ────────────────────────────────────────────

async function checkClassSoon(
  now: Date,
  dryRun: boolean,
): Promise<number> {
  const windowEnd = new Date(now.getTime() + 45 * 60 * 1000); // now + 45 min

  // Sessions that are scheduled and start within [now, now+45min]
  const sessions = await db
    .select()
    .from(classSessions)
    .where(
      and(
        eq(classSessions.status, 'scheduled'),
        gt(classSessions.scheduledAt, now),
        lt(classSessions.scheduledAt, windowEnd),
      ),
    );

  let count = 0;

  for (const session of sessions) {
    const markerKey = `notified:class_soon:${session.id}`;

    // Check dedup marker
    const alreadyNotified = await getLmsSetting(markerKey);
    if (alreadyNotified !== null) continue;

    const emails = await getAttendeeEmails({
      product: session.product,
      batch: session.batch ?? null,
    });

    if (emails.length === 0) {
      if (!dryRun) await setLmsSetting(markerKey, new Date().toISOString());
      continue;
    }

    count += emails.length;

    if (!dryRun) {
      const baseUrl = (process.env.NEXTAUTH_URL ?? 'https://vh-beyondthehorizons.org').replace(/\/$/, '');
      const dashboardUrl = `${baseUrl}/dashboard`;

      const results = await Promise.allSettled(
        emails.map(async (email) => {
          const name = await getUserName(email);
          return sendLmsClassSoon(email, {
            name,
            sessionTitle: session.title,
            scheduledAt: session.scheduledAt,
            subject: session.subject,
            dashboardUrl,
          });
        }),
      );

      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        console.error(
          `[lms-reminders] classSoon session ${session.id}: ${failed} emails failed`,
        );
      }

      // Set marker after send (even if some failed — avoids repeated blasts)
      await setLmsSetting(markerKey, new Date().toISOString());

      console.log(
        `[lms-reminders] classSoon session ${session.id}: notified ${emails.length - failed} of ${emails.length}`,
      );
    }
  }

  return count;
}

// ─── Check 2: Homework due within 24h ────────────────────────────────────────

async function checkHwDue(
  now: Date,
  dryRun: boolean,
): Promise<number> {
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000); // now + 24h

  // Assignments due within [now, now+24h]
  const dueAssignments = await db
    .select()
    .from(assignments)
    .where(
      and(
        gt(assignments.dueAt, now),
        lt(assignments.dueAt, windowEnd),
      ),
    );

  let count = 0;

  for (const assignment of dueAssignments) {
    const markerKey = `notified:hw_due:${assignment.id}`;

    const alreadyNotified = await getLmsSetting(markerKey);
    if (alreadyNotified !== null) continue;

    // All potential recipients
    const emails = await getAttendeeEmails({
      product: assignment.product,
      batch: assignment.batch ?? null,
    });

    if (emails.length === 0) {
      if (!dryRun) await setLmsSetting(markerKey, new Date().toISOString());
      continue;
    }

    // Find user IDs who already submitted
    const emailToId = await db
      .select({ email: users.email, id: users.id })
      .from(users)
      .where(inArray(users.email, emails));

    const allUserIds = emailToId.map((r) => r.id);

    // Users who have already submitted
    let submittedUserIds: number[] = [];
    if (allUserIds.length > 0) {
      const subs = await db
        .select({ userId: assignmentSubmissions.userId })
        .from(assignmentSubmissions)
        .where(eq(assignmentSubmissions.assignmentId, assignment.id));
      submittedUserIds = subs.map((s) => s.userId);
    }

    // Emails of users who have NOT submitted
    const pendingEmails = emailToId
      .filter((r) => !submittedUserIds.includes(r.id))
      .map((r) => r.email);

    if (pendingEmails.length === 0) {
      if (!dryRun) await setLmsSetting(markerKey, new Date().toISOString());
      continue;
    }

    count += pendingEmails.length;

    if (!dryRun) {
      const baseUrl = (process.env.NEXTAUTH_URL ?? 'https://vh-beyondthehorizons.org').replace(/\/$/, '');
      const assignmentUrl = `${baseUrl}/dashboard/assignments/${assignment.id}`;

      const results = await Promise.allSettled(
        pendingEmails.map(async (email) => {
          const name = await getUserName(email);
          return sendLmsHomeworkDue(email, {
            name,
            assignmentTitle: assignment.title,
            dueAt: assignment.dueAt,
            assignmentUrl,
          });
        }),
      );

      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        console.error(
          `[lms-reminders] hwDue assignment ${assignment.id}: ${failed} emails failed`,
        );
      }

      await setLmsSetting(markerKey, new Date().toISOString());

      console.log(
        `[lms-reminders] hwDue assignment ${assignment.id}: notified ${pendingEmails.length - failed} of ${pendingEmails.length}`,
      );
    }
  }

  return count;
}

// ─── Check 3: Recording published ────────────────────────────────────────────

async function checkRecordingPublished(
  now: Date,
  dryRun: boolean,
): Promise<number> {
  const window24hAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Recordings that became available within the last 24h
  const availableRecordings = await db
    .select({
      id: recordings.id,
      classSessionId: recordings.classSessionId,
      createdAt: recordings.createdAt,
    })
    .from(recordings)
    .where(
      and(
        eq(recordings.status, 'available'),
        gt(recordings.createdAt, window24hAgo),
      ),
    );

  let count = 0;

  for (const rec of availableRecordings) {
    const markerKey = `notified:rec_pub:${rec.id}`;

    const alreadyNotified = await getLmsSetting(markerKey);
    if (alreadyNotified !== null) continue;

    // Get session details
    const session = await db
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, rec.classSessionId))
      .get();

    if (!session) continue;

    const emails = await getAttendeeEmails({
      product: session.product,
      batch: session.batch ?? null,
    });

    if (emails.length === 0) {
      if (!dryRun) await setLmsSetting(markerKey, new Date().toISOString());
      continue;
    }

    count += emails.length;

    if (!dryRun) {
      const baseUrl = (process.env.NEXTAUTH_URL ?? 'https://vh-beyondthehorizons.org').replace(/\/$/, '');
      const recordingUrl = `${baseUrl}/dashboard/classes/${session.id}/recording`;

      const results = await Promise.allSettled(
        emails.map(async (email) => {
          const name = await getUserName(email);
          return sendLmsRecordingPublished(email, {
            name,
            sessionTitle: session.title,
            sessionId: session.id,
            recordingUrl,
          });
        }),
      );

      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        console.error(
          `[lms-reminders] recPublished recording ${rec.id}: ${failed} emails failed`,
        );
      }

      await setLmsSetting(markerKey, new Date().toISOString());

      console.log(
        `[lms-reminders] recPublished recording ${rec.id}: notified ${emails.length - failed} of ${emails.length}`,
      );
    }
  }

  return count;
}

// ─── Check 4: Recording expiring ─────────────────────────────────────────────
// A recording is "about to expire" when exactly 1 subsequent completed class
// exists for that subject+product+batch. When the next class completes, count
// will reach 2 and the recording becomes inaccessible.

async function checkRecordingExpiring(
  now: Date,
  dryRun: boolean,
): Promise<number> {
  // All available recordings
  const availableRecordings = await db
    .select({
      id: recordings.id,
      classSessionId: recordings.classSessionId,
    })
    .from(recordings)
    .where(eq(recordings.status, 'available'));

  let count = 0;

  for (const rec of availableRecordings) {
    const markerKey = `notified:rec_exp:${rec.id}`;

    const alreadyNotified = await getLmsSetting(markerKey);
    if (alreadyNotified !== null) continue;

    // Get session details
    const session = await db
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, rec.classSessionId))
      .get();

    if (!session) continue;

    // Count subsequent completed classes — if exactly 1, one more will expire it
    const subsequentCount = await countSubsequentCompletedClasses({
      id: session.id,
      subject: session.subject,
      product: session.product,
      batch: session.batch ?? null,
      scheduledAt: session.scheduledAt,
    });

    if (subsequentCount !== 1) continue; // not the expiry-warning threshold

    const emails = await getAttendeeEmails({
      product: session.product,
      batch: session.batch ?? null,
    });

    if (emails.length === 0) {
      if (!dryRun) await setLmsSetting(markerKey, new Date().toISOString());
      continue;
    }

    count += emails.length;

    if (!dryRun) {
      const baseUrl = (process.env.NEXTAUTH_URL ?? 'https://vh-beyondthehorizons.org').replace(/\/$/, '');
      const recordingUrl = `${baseUrl}/dashboard/classes/${session.id}/recording`;

      const results = await Promise.allSettled(
        emails.map(async (email) => {
          const name = await getUserName(email);
          return sendLmsRecordingExpiring(email, {
            name,
            sessionTitle: session.title,
            recordingUrl,
          });
        }),
      );

      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        console.error(
          `[lms-reminders] recExpiring recording ${rec.id}: ${failed} emails failed`,
        );
      }

      await setLmsSetting(markerKey, new Date().toISOString());

      console.log(
        `[lms-reminders] recExpiring recording ${rec.id}: notified ${emails.length - failed} of ${emails.length}`,
      );
    }
  }

  return count;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

async function handler(req: NextRequest) {
  const authError = checkSecret(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get('dryRun') === '1';

  const now = new Date();

  const results = {
    classSoon: 0,
    hwDue: 0,
    recPublished: 0,
    recExpiring: 0,
    dryRun,
  };

  // Each check is isolated — one failing must not block others.

  try {
    results.classSoon = await checkClassSoon(now, dryRun);
  } catch (err) {
    console.error('[lms-reminders] checkClassSoon failed:', err);
  }

  try {
    results.hwDue = await checkHwDue(now, dryRun);
  } catch (err) {
    console.error('[lms-reminders] checkHwDue failed:', err);
  }

  try {
    results.recPublished = await checkRecordingPublished(now, dryRun);
  } catch (err) {
    console.error('[lms-reminders] checkRecordingPublished failed:', err);
  }

  try {
    results.recExpiring = await checkRecordingExpiring(now, dryRun);
  } catch (err) {
    console.error('[lms-reminders] checkRecordingExpiring failed:', err);
  }

  console.log('[lms-reminders] done:', results);

  return NextResponse.json(results);
}

export const GET  = handler;
export const POST = handler;

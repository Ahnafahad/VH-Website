// ─── Session Generator — Algorithm D (DB layer) ───────────────────────────────
// Materialises class_sessions from active class_schedules 14 days ahead.
// Idempotent: safe to run repeatedly.
//
// Pure occurrence computation lives in schedule-generator-pure.ts so it can be
// unit-tested without a DB connection.

import { db } from '@/lib/db';
import { classSchedules, classSessions } from '@/lib/db/schema';
import { and, eq, gte, lte } from 'drizzle-orm';
import { computeOccurrences } from './schedule-generator-pure';
import {
  SCHEDULE_GENERATOR_DAYS_AHEAD,
  SCHEDULE_GENERATOR_DEDUP_HOURS,
} from './constants';

// Re-export the pure function so callers can import from a single module
export { computeOccurrences } from './schedule-generator-pure';

/**
 * For each active class_schedules rule: compute Dhaka-local occurrences → UTC,
 * insert class_sessions rows (status='scheduled') if none exists for that
 * scheduleId within ±12h of the occurrence.
 *
 * Returns the count of newly inserted sessions.
 */
export async function generateSessionsFromSchedules(
  daysAhead: number = SCHEDULE_GENERATOR_DAYS_AHEAD,
): Promise<number> {
  const fromDate = new Date();
  const dedupWindowMs = SCHEDULE_GENERATOR_DEDUP_HOURS * 3600_000;

  // Load all active schedules
  const schedules = await db
    .select()
    .from(classSchedules)
    .where(eq(classSchedules.active, true));

  let inserted = 0;

  for (const schedule of schedules) {
    const occurrences = computeOccurrences(schedule, fromDate, daysAhead);

    for (const occurrenceUtc of occurrences) {
      const windowStart = new Date(occurrenceUtc.getTime() - dedupWindowMs);
      const windowEnd   = new Date(occurrenceUtc.getTime() + dedupWindowMs);

      // Check if a session already exists for this schedule within ±12h
      const existing = await db
        .select({ id: classSessions.id })
        .from(classSessions)
        .where(
          and(
            eq(classSessions.scheduleId, schedule.id),
            gte(classSessions.scheduledAt, windowStart),
            lte(classSessions.scheduledAt, windowEnd),
          ),
        )
        .get();

      if (existing) continue;

      await db.insert(classSessions).values({
        scheduleId:      schedule.id,
        title:           schedule.titleTemplate,
        subject:         schedule.subject,
        product:         schedule.product,
        batch:           schedule.batch,
        scheduledAt:     occurrenceUtc,
        durationMinutes: schedule.durationMinutes,
        status:          'scheduled',
        createdBy:       schedule.createdBy,
      });

      inserted++;
    }
  }

  return inserted;
}

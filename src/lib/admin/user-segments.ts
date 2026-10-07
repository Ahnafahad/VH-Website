/**
 * Admin Users page segments. One definition per segment, used both for the filter
 * (`segmentCondition`) and the whole-population counts (`getSegmentCounts`), so a chip's number
 * always matches the rows it filters to.
 *
 * "Logged in" = the person has at least one authenticated analytics session (the only login
 * record the site keeps). Once vs several = number of distinct calendar days they were seen on.
 * "Registered" = we hold a phone number for them, or they have used an app (LexiCore, Mental
 * Math, FBS Accounting, or an online test).
 */

import { sql, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import type { SegmentCounts, SegmentKey } from './user-segments-shared';

export { SEGMENT_KEYS, SEGMENT_LABELS, isSegmentKey, type SegmentCounts, type SegmentKey } from './user-segments-shared';

const loginDays = sql`(SELECT count(DISTINCT date(s.started_at, 'unixepoch')) FROM analytics_sessions s WHERE s.user_id = ${users.id})`;

const registered = sql`(coalesce(trim(${users.whatsapp}), '') <> ''
  OR EXISTS (SELECT 1 FROM vocab_user_progress p WHERE p.user_id = ${users.id})
  OR EXISTS (SELECT 1 FROM math_user_progress p WHERE p.user_id = ${users.id})
  OR EXISTS (SELECT 1 FROM accounting_progress p WHERE lower(p.player_email) = lower(${users.email}))
  OR EXISTS (SELECT 1 FROM test_attempts p WHERE p.user_id = ${users.id}))`;

const CONDITIONS: Record<SegmentKey, SQL> = {
  enrolled: sql`(${users.role} = 'student' AND ${users.status} = 'active' AND EXISTS (
    SELECT 1 FROM user_access a JOIN batches b ON b.name = ${users.batch} AND b.product = a.product AND b.status = 'active'
    WHERE a.user_id = ${users.id} AND a.active = 1))`,
  registered,
  logged_in:                sql`(${loginDays} >= 1)`,
  never_logged_in:          sql`(${loginDays} = 0)`,
  logged_in_once:           sql`(${loginDays} = 1)`,
  logged_in_multiple:       sql`(${loginDays} >= 2)`,
  logged_in_not_registered: sql`(${loginDays} >= 1 AND NOT ${registered})`,
  batch_without_access: sql`(${users.role} = 'student' AND ${users.batch} IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM user_access a WHERE a.user_id = ${users.id} AND a.active = 1))`,
  enrolled_never_logged_in: sql`(${loginDays} = 0 AND (${users.role} = 'student' AND ${users.status} = 'active' AND EXISTS (
    SELECT 1 FROM user_access a JOIN batches b ON b.name = ${users.batch} AND b.product = a.product AND b.status = 'active'
    WHERE a.user_id = ${users.id} AND a.active = 1)))`,
};

export function segmentCondition(key: SegmentKey): SQL {
  return CONDITIONS[key];
}

const countIf = (cond: SQL) => sql<number>`coalesce(sum(CASE WHEN ${cond} THEN 1 ELSE 0 END), 0)`;

export async function getSegmentCounts(): Promise<SegmentCounts> {
  const row = await db.select({
    total:       sql<number>`count(*)`,
    student:     countIf(sql`${users.role} = 'student'`),
    instructor:  countIf(sql`${users.role} = 'instructor'`),
    admin:       countIf(sql`${users.role} = 'admin'`),
    super_admin: countIf(sql`${users.role} = 'super_admin'`),
    enrolled:                 countIf(CONDITIONS.enrolled),
    registered:               countIf(CONDITIONS.registered),
    logged_in:                countIf(CONDITIONS.logged_in),
    never_logged_in:          countIf(CONDITIONS.never_logged_in),
    logged_in_once:           countIf(CONDITIONS.logged_in_once),
    logged_in_multiple:       countIf(CONDITIONS.logged_in_multiple),
    logged_in_not_registered: countIf(CONDITIONS.logged_in_not_registered),
    batch_without_access:     countIf(CONDITIONS.batch_without_access),
    enrolled_never_logged_in: countIf(CONDITIONS.enrolled_never_logged_in),
  }).from(users).get();
  const out = { ...row } as Record<string, number>;
  for (const k of Object.keys(out)) out[k] = Number(out[k] ?? 0);
  return out as SegmentCounts;
}

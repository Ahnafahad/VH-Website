/**
 * POST /api/lms/admin/classes/generate
 * Materialise class_sessions from active schedules (14 days ahead).
 */

import { safeApiHandler } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { generateSessionsFromSchedules } from '@/lib/lms/schedule-generator';

export async function POST() {
  return safeApiHandler(async () => {
    await requireStaff();
    const created = await generateSessionsFromSchedules();
    return { created };
  });
}

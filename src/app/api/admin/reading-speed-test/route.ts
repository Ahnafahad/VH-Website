/**
 * GET /api/admin/reading-speed-test — every attempt, newest first (staff-gated).
 * DELETE /api/admin/reading-speed-test — wipes ALL attempts for ALL users.
 */

import { safeApiHandler } from '@/lib/api-utils';
import { requireReadingSpeedStaff } from '@/lib/reading-speed-test/route-helpers';
import { listAllAttemptsForAdmin, resetAllAttempts } from '@/lib/reading-speed-test/service';

export async function GET() {
  return safeApiHandler(async () => {
    await requireReadingSpeedStaff();
    return { attempts: await listAllAttemptsForAdmin() };
  });
}

export async function DELETE() {
  return safeApiHandler(async () => {
    await requireReadingSpeedStaff();
    await resetAllAttempts();
    return { ok: true };
  });
}

/**
 * GET /api/admin/redline/students/[id]
 * One student's level path + full analysis, for the admin drill-down.
 */

import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireRedlineStaff } from '@/lib/redline/route-helpers';
import { getStudentForAdmin } from '@/lib/redline/service';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    await requireRedlineStaff();
    const id = Number((await params).id);
    if (!Number.isInteger(id)) throw new ApiException('Invalid student', 400);
    return getStudentForAdmin(id);
  });
}

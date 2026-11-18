import { type NextRequest } from 'next/server';
import { ApiException, safeApiHandler } from '@/lib/api-utils';
import { isAdminRole } from '@/lib/auth/roles';
import { getStudentReport, listReportStudents } from '@/lib/mocks/student-report-data';
import { requireStaff } from '@/lib/tests/route-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return safeApiHandler(async () => {
    const user = await requireStaff();
    if (!isAdminRole(user.role)) throw new ApiException('Admin access required', 403, 'FORBIDDEN');

    const raw = request.nextUrl.searchParams.get('userId');
    if (raw === null) return listReportStudents();

    const userId = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(userId) || userId < 1) {
      throw new ApiException('Invalid user ID', 400, 'INVALID_USER_ID');
    }
    const report = await getStudentReport(userId);
    if (!report) throw new ApiException('No submitted mock results found for this student', 404, 'REPORT_NOT_FOUND');
    return report;
  });
}

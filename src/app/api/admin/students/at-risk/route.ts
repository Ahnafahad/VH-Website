import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { createErrorResponse, ApiException } from '@/lib/api-utils';
import { getAtRiskStudents } from '@/lib/students/at-risk';
import { isStaffRole } from '@/lib/auth/roles';

// ─── Auth helper (staff only: admin, super_admin, instructor) ─────────────────

async function requireStaff() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new ApiException('Authentication required', 401);
  if (!isStaffRole(session.user.role)) {
    throw new ApiException('Unauthorized', 403);
  }
  return session.user;
}

// ─── GET /api/admin/students/at-risk ────────────────────────────────────────────
// Split out from the students/users pages because getAtRiskStudents() fans out
// a heavy per-student metrics scan (minutes at current data volume) — fetched
// client-side after the rest of the page has already rendered, not awaited
// in the page's own server-side data fetch.

export async function GET() {
  try {
    await requireStaff();
    const atRiskStudents = await getAtRiskStudents();
    return NextResponse.json({ success: true, atRiskStudents });
  } catch (error) {
    return createErrorResponse(error);
  }
}

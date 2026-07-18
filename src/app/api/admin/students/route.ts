import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { createErrorResponse, ApiException } from '@/lib/api-utils';
import { listBatches, getBatchSummaries } from '@/lib/students/progress';

// ─── Auth helper (staff only: admin, super_admin, instructor) ─────────────────

async function requireStaff() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new ApiException('Authentication required', 401);
  if (!session.user.role || !['admin', 'super_admin', 'instructor'].includes(session.user.role)) {
    throw new ApiException('Unauthorized', 403);
  }
  return session.user;
}

// ─── GET /api/admin/students ────────────────────────────────────────────────────
// No ?batch= → BatchListResponse. ?batch=X → BatchSummaryResponse for batch X.

export async function GET(request: NextRequest) {
  try {
    await requireStaff();

    const { searchParams } = new URL(request.url);
    const batch = searchParams.get('batch');

    if (batch) {
      return NextResponse.json({ success: true, ...(await getBatchSummaries(batch)) });
    }
    return NextResponse.json({ success: true, ...(await listBatches()) });
  } catch (error) {
    return createErrorResponse(error);
  }
}

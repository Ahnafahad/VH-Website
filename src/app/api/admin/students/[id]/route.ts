import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { createErrorResponse, ApiException } from '@/lib/api-utils';
import { getStudentDetail } from '@/lib/students/progress';

// ─── Auth helper (staff only: admin, super_admin, instructor) ─────────────────

async function requireStaff() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new ApiException('Authentication required', 401);
  if (!session.user.role || !['admin', 'super_admin', 'instructor'].includes(session.user.role)) {
    throw new ApiException('Unauthorized', 403);
  }
  return session.user;
}

// ─── GET /api/admin/students/[id] ───────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaff();

    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) throw new ApiException('Invalid student id', 400);

    const detail = await getStudentDetail(userId);
    if (!detail) throw new ApiException('Student not found', 404);

    return NextResponse.json({ success: true, ...detail });
  } catch (error) {
    return createErrorResponse(error);
  }
}

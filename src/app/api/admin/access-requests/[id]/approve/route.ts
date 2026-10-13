import { NextRequest, NextResponse } from 'next/server';
import { approveVocabAccessRequest } from '@/lib/vocab/access-requests';
import { createErrorResponse, ApiException } from '@/lib/api-utils';
import { isAdminEmail } from '@/lib/db-access-control';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new ApiException('Authentication required', 401);
  if (!(await isAdminEmail(session.user.email))) throw new ApiException('Unauthorized', 403);
  return session.user.email;
}

// ─── POST /api/admin/access-requests/[id]/approve ─────────────────────────────
// Approves a LexiCore access request: upgrades user vocab phase to 1 and
// updates the request status to 'approved'.

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const reqId  = parseInt(id, 10);
    if (isNaN(reqId)) throw new ApiException('Invalid request id', 400);

    await approveVocabAccessRequest(reqId);

    return NextResponse.json({ success: true, message: 'Access granted — phase upgraded to 1' });
  } catch (error) {
    return createErrorResponse(error);
  }
}

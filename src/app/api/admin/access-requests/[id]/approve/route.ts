import { NextRequest, NextResponse } from 'next/server';
import { db, users, vocabAccessRequests, vocabUserProgress } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
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

    // Load the access request
    const accessReq = await db
      .select()
      .from(vocabAccessRequests)
      .where(eq(vocabAccessRequests.id, reqId))
      .get();

    if (!accessReq) throw new ApiException('Access request not found', 404);
    if (accessReq.status !== 'pending') {
      throw new ApiException(`Request already ${accessReq.status}`, 409);
    }

    // Verify user exists
    const user = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, accessReq.userId))
      .get();
    if (!user) throw new ApiException('User not found', 404);

    // Upgrade vocab phase to 1 (full access)
    // Upsert vocab_user_progress so it works whether or not a row exists
    const existing = await db
      .select({ id: vocabUserProgress.id })
      .from(vocabUserProgress)
      .where(eq(vocabUserProgress.userId, accessReq.userId))
      .get();

    if (existing) {
      await db
        .update(vocabUserProgress)
        .set({ phase: 1, updatedAt: new Date() })
        .where(eq(vocabUserProgress.userId, accessReq.userId));
    } else {
      await db
        .insert(vocabUserProgress)
        .values({ userId: accessReq.userId, phase: 1 });
    }

    // Mark request as approved
    await db
      .update(vocabAccessRequests)
      .set({ status: 'approved', updatedAt: new Date() })
      .where(eq(vocabAccessRequests.id, reqId));

    return NextResponse.json({ success: true, message: 'Access granted — phase upgraded to 1' });
  } catch (error) {
    return createErrorResponse(error);
  }
}

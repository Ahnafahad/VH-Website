import { NextRequest, NextResponse } from 'next/server';
import { db, users, vocabAccessRequests } from '@/lib/db';
import { eq, desc, and } from 'drizzle-orm';
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

// ─── GET /api/admin/access-requests ──────────────────────────────────────────
// Query: ?status=pending|approved|rejected  (default: pending)

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? 'pending';

    // Join requests with user info
    const rows = await db
      .select({
        id:        vocabAccessRequests.id,
        userId:    vocabAccessRequests.userId,
        whatsapp:  vocabAccessRequests.whatsapp,
        message:   vocabAccessRequests.message,
        status:    vocabAccessRequests.status,
        createdAt: vocabAccessRequests.createdAt,
        updatedAt: vocabAccessRequests.updatedAt,
        userName:  users.name,
        userEmail: users.email,
        userRole:  users.role,
      })
      .from(vocabAccessRequests)
      .innerJoin(users, eq(vocabAccessRequests.userId, users.id))
      .where(
        status === 'all'
          ? undefined
          : eq(vocabAccessRequests.status, status),
      )
      .orderBy(desc(vocabAccessRequests.createdAt));

    return NextResponse.json({ success: true, requests: rows, count: rows.length });
  } catch (error) {
    return createErrorResponse(error);
  }
}

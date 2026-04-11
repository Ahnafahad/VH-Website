import { NextRequest, NextResponse } from 'next/server';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createErrorResponse, ApiException } from '@/lib/api-utils';
import { isAdminEmail, getUserByEmail, clearAccessControlCache } from '@/lib/db-access-control';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new ApiException('Authentication required', 401);
  if (!(await isAdminEmail(session.user.email))) throw new ApiException('Unauthorized', 403);
  return session.user.email;
}

// ─── POST /api/admin/users/[id]/suspend ───────────────────────────────────────
// Toggles user status between 'active' and 'inactive'.
// Body: { action: 'suspend' | 'reactivate' }  (optional — toggles if omitted)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const adminEmail = await requireAdmin();
    const { id }     = await params;
    const userId     = parseInt(id, 10);
    if (isNaN(userId)) throw new ApiException('Invalid user id', 400);

    const existing = await db.select().from(users).where(eq(users.id, userId)).get();
    if (!existing) throw new ApiException('User not found', 404);

    // Prevent modifying super_admin unless the acting admin is also super_admin
    const adminUser = await getUserByEmail(adminEmail);
    if (existing.role === 'super_admin' && adminUser?.role !== 'super_admin') {
      throw new ApiException('Only super admins can suspend super admin accounts', 403);
    }

    // Determine target status
    let body: { action?: string } = {};
    try { body = await request.json(); } catch { /* empty body is fine */ }

    let newStatus: 'active' | 'inactive';
    if (body.action === 'suspend')     newStatus = 'inactive';
    else if (body.action === 'reactivate') newStatus = 'active';
    else newStatus = existing.status === 'active' ? 'inactive' : 'active';

    const [updated] = await db
      .update(users)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    clearAccessControlCache(updated.email);

    return NextResponse.json({
      success:   true,
      status:    updated.status,
      suspended: updated.status === 'inactive',
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}

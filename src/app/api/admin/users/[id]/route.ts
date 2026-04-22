import { NextRequest, NextResponse } from 'next/server';
import { db, users, userAccess, vocabUserBadges, vocabUserProgress } from '@/lib/db';
import { eq, and, count } from 'drizzle-orm';
import { createErrorResponse, ApiException } from '@/lib/api-utils';
import {
  isAdminEmail,
  getUserByEmail,
  clearAccessControlCache,
  grantProduct,
  revokeProduct,
} from '@/lib/db-access-control';
import { assertRoleAssignable } from '@/lib/admin/role-guards';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import type { UserProduct } from '@/lib/db/schema';

// ─── Auth helper (inline, avoids validateAuth which checks isEmailAuthorized) ──

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new ApiException('Authentication required', 401);
  if (!(await isAdminEmail(session.user.email))) throw new ApiException('Unauthorized', 403);
  return session.user.email;
}

// ─── GET /api/admin/users/[id] ─────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const adminEmail = await requireAdmin();
    const { id }     = await params;
    const userId     = parseInt(id, 10);
    if (isNaN(userId)) throw new ApiException('Invalid user id', 400);

    // Base user row
    const user = await db.select().from(users).where(eq(users.id, userId)).get();
    if (!user) throw new ApiException('User not found', 404);

    // Products
    const accessRows = await db
      .select({ product: userAccess.product })
      .from(userAccess)
      .where(and(eq(userAccess.userId, userId), eq(userAccess.active, true)));
    const products = accessRows.map(r => r.product as UserProduct);

    // Vocab progress (optional — user may not have started LexiCore)
    const progress = await db
      .select()
      .from(vocabUserProgress)
      .where(eq(vocabUserProgress.userId, userId))
      .get();

    // Badge count
    const [badgeRow] = await db
      .select({ total: count() })
      .from(vocabUserBadges)
      .where(and(eq(vocabUserBadges.userId, userId)));
    const badgeCount = badgeRow?.total ?? 0;

    void adminEmail; // admin check passed

    return NextResponse.json({
      success: true,
      user: {
        ...user,
        products,
        vocabProgress: progress ?? null,
        badgeCount,
      },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}

// ─── PATCH /api/admin/users/[id] ───────────────────────────────────────────────
// Supports: role, status, name, studentId, class, batch, notes, products

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const adminEmail = await requireAdmin();
    const { id }     = await params;
    const userId     = parseInt(id, 10);
    if (isNaN(userId)) throw new ApiException('Invalid user id', 400);

    const body = await request.json() as Record<string, unknown>;
    const { products: newProducts, ...updates } = body;

    const existing = await db.select().from(users).where(eq(users.id, userId)).get();
    if (!existing) throw new ApiException('User not found', 404);

    // Prevent non-super-admins from touching super_admin accounts
    const adminUser = await getUserByEmail(adminEmail);
    if (existing.role === 'super_admin' && adminUser?.role !== 'super_admin') {
      throw new ApiException('Only super admins can modify super admin accounts', 403);
    }

    if (updates['role'] !== undefined) {
      if (existing.id === adminUser?.id) {
        throw new ApiException('You cannot change your own role', 403);
      }
      assertRoleAssignable(updates['role'], adminUser?.role);
    }

    // Build safe update set
    const updateSet: Record<string, unknown> = { updatedAt: new Date() };
    const allowed = ['name', 'role', 'status', 'studentId', 'class', 'batch', 'notes'];
    for (const key of allowed) {
      if (updates[key] !== undefined) updateSet[key] = updates[key];
    }

    const [updated] = await db
      .update(users)
      .set(updateSet)
      .where(eq(users.id, userId))
      .returning();

    // Sync products if provided
    if (newProducts !== undefined && Array.isArray(newProducts)) {
      const current = await db
        .select({ product: userAccess.product })
        .from(userAccess)
        .where(and(eq(userAccess.userId, userId), eq(userAccess.active, true)));
      const currentSet = new Set<UserProduct>(current.map(r => r.product as UserProduct));
      const newSet     = new Set<UserProduct>(newProducts as UserProduct[]);

      for (const p of newProducts as UserProduct[]) {
        if (!currentSet.has(p)) await grantProduct(userId, p);
      }
      for (const p of currentSet) {
        if (!newSet.has(p)) await revokeProduct(userId, p);
      }
    }

    clearAccessControlCache(updated.email);
    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    return createErrorResponse(error);
  }
}

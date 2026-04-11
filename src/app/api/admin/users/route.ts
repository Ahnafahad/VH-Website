import { NextRequest, NextResponse } from 'next/server';
import { db, users, userAccess } from '@/lib/db';
import { eq, and, or, like, desc, ne, inArray } from 'drizzle-orm';
import { validateAuth, createErrorResponse, ApiException } from '@/lib/api-utils';
import { isAdminEmail, isSuperAdminEmail, getUserByEmail, clearAccessControlCache, grantProduct, revokeProduct } from '@/lib/db-access-control';
import type { UserProduct } from '@/lib/db/schema';

// GET — list users
export async function GET(request: NextRequest) {
  try {
    const auth = await validateAuth();
    if (!(await isAdminEmail(auth.email))) throw new ApiException('Unauthorized', 403);

    const { searchParams } = new URL(request.url);
    const role   = searchParams.get('role');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const conditions = [];
    if (role)   conditions.push(eq(users.role, role));
    if (status) conditions.push(eq(users.status, status));
    if (search) {
      conditions.push(or(
        like(users.name,  `%${search}%`),
        like(users.email, `%${search}%`),
        like(users.studentId ?? '', `%${search}%`),
      )!);
    }

    const rows = await db
      .select()
      .from(users)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(users.createdAt));

    // Attach products to each user
    const ids = rows.map(u => u.id);
    const accessRows = ids.length
      ? await db.select().from(userAccess).where(and(inArray(userAccess.userId, ids), eq(userAccess.active, true)))
      : [];

    const productMap = new Map<number, string[]>();
    for (const a of accessRows) {
      if (!productMap.has(a.userId)) productMap.set(a.userId, []);
      productMap.get(a.userId)!.push(a.product);
    }

    const result = rows.map(u => ({ ...u, products: productMap.get(u.id) || [] }));

    return NextResponse.json({ success: true, users: result, count: result.length });
  } catch (error) {
    return createErrorResponse(error);
  }
}

// POST — create user
export async function POST(request: NextRequest) {
  try {
    const auth = await validateAuth();
    if (!(await isAdminEmail(auth.email))) throw new ApiException('Unauthorized', 403);

    const body = await request.json();
    const { email, name, role, studentId, class: userClass, batch, products, notes } = body;

    if (!email || !name || !role) throw new ApiException('email, name, role are required', 400);
    if (!email.includes('@'))     throw new ApiException('Invalid email', 400);

    const normalEmail = email.toLowerCase().trim();

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, normalEmail)).get();
    if (existing) throw new ApiException('Email already exists', 409);

    if (studentId) {
      const sidExists = await db.select({ id: users.id }).from(users).where(eq(users.studentId, studentId)).get();
      if (sidExists) throw new ApiException('Student ID already in use', 409);
    }

    const [newUser] = await db
      .insert(users)
      .values({
        email: normalEmail,
        name:      name.trim(),
        role,
        status:    'active',
        studentId: studentId?.trim() || null,
        class:     userClass?.trim() || null,
        batch:     batch?.trim()     || null,
        notes:     notes             || null,
      })
      .returning();

    if (products && Array.isArray(products) && products.length > 0) {
      for (const product of products) {
        await grantProduct(newUser.id, product as UserProduct);
      }
    }

    clearAccessControlCache(normalEmail);
    return NextResponse.json({ success: true, user: { ...newUser, products: products || [] } }, { status: 201 });
  } catch (error) {
    return createErrorResponse(error);
  }
}

// PATCH — update user
export async function PATCH(request: NextRequest) {
  try {
    const auth = await validateAuth();
    if (!(await isAdminEmail(auth.email))) throw new ApiException('Unauthorized', 403);

    const body = await request.json();
    const { userId, products: newProducts, ...updates } = body;

    if (!userId) throw new ApiException('userId required', 400);

    const existing = await db.select().from(users).where(eq(users.id, userId)).get();
    if (!existing) throw new ApiException('User not found', 404);

    const adminUser = await getUserByEmail(auth.email);
    if (existing.role === 'super_admin' && adminUser?.role !== 'super_admin') {
      throw new ApiException('Only super admins can modify super admin accounts', 403);
    }

    // Build update set (only defined fields)
    const updateSet: Record<string, unknown> = { updatedAt: new Date() };
    const allowed = ['name', 'role', 'status', 'studentId', 'class', 'batch', 'notes'];
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        updateSet[key] = updates[key];
      }
    }
    if (updates.email) {
      const normalEmail = updates.email.toLowerCase().trim();
      const dup = await db.select({ id: users.id }).from(users)
        .where(and(eq(users.email, normalEmail), ne(users.id, userId))).get();
      if (dup) throw new ApiException('Email already in use', 409);
      updateSet.email = normalEmail;
    }

    const [updated] = await db.update(users).set(updateSet).where(eq(users.id, userId)).returning();

    // Sync products if provided
    if (newProducts !== undefined && Array.isArray(newProducts)) {
      const current = await db
        .select({ product: userAccess.product })
        .from(userAccess)
        .where(and(eq(userAccess.userId, userId), eq(userAccess.active, true)));
      const currentSet = new Set<UserProduct>(current.map(r => r.product as UserProduct));
      const newSet     = new Set<UserProduct>((newProducts as UserProduct[]));

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

// DELETE — delete user (super_admin only)
export async function DELETE(request: NextRequest) {
  try {
    const auth = await validateAuth();
    if (!(await isSuperAdminEmail(auth.email))) throw new ApiException('Only super admins can delete users', 403);

    const { searchParams } = new URL(request.url);
    const userId = parseInt(searchParams.get('userId') || '');
    if (!userId) throw new ApiException('userId required', 400);

    const existing = await db.select().from(users).where(eq(users.id, userId)).get();
    if (!existing) throw new ApiException('User not found', 404);
    if (existing.role === 'super_admin') throw new ApiException('Cannot delete super admin accounts', 403);

    await db.delete(users).where(eq(users.id, userId));
    clearAccessControlCache(existing.email);

    return NextResponse.json({ success: true, message: 'User deleted' });
  } catch (error) {
    return createErrorResponse(error);
  }
}

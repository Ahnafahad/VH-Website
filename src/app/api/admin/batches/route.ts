/**
 * GET  /api/admin/batches — list all batches (newest first). Staff (incl. instructors),
 *      because instructor-accessible pages (Homework, Today's) need the batch dropdown.
 * POST /api/admin/batches — create a batch { name, product, status? }. Admin/super-admin only.
 */

import { NextRequest } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { batches } from '@/lib/db/schema';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';
import { getUserByEmail } from '@/lib/db-access-control';
import { isAdminRole, isStaffRole } from '@/lib/auth/roles';

const VALID_PRODUCTS = ['iba', 'fbs', 'fbs_detailed'] as const;

async function requireAdmin(): Promise<void> {
  const auth = await validateAuth();
  const user = await getUserByEmail(auth.email);
  if (!user || !isAdminRole(user.role)) {
    throw new ApiException('Admin access required', 403);
  }
}

async function requireStaff(): Promise<void> {
  const auth = await validateAuth();
  const user = await getUserByEmail(auth.email);
  if (!user || !isStaffRole(user.role)) {
    throw new ApiException('Staff access required', 403);
  }
}

export async function GET() {
  return safeApiHandler(async () => {
    await requireStaff();
    const rows = await db.select().from(batches).orderBy(desc(batches.createdAt));
    return { batches: rows };
  });
}

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    await requireAdmin();

    const body = await req.json();
    const { name, product, status } = body as { name?: string; product?: string; status?: string };

    if (!name?.trim()) throw new ApiException('name is required', 400);
    if (!product || !(VALID_PRODUCTS as readonly string[]).includes(product)) {
      throw new ApiException(`product must be one of: ${VALID_PRODUCTS.join(', ')}`, 400);
    }
    if (status !== undefined && status !== 'active' && status !== 'archived') {
      throw new ApiException("status must be 'active' or 'archived'", 400);
    }

    const existing = await db.select({ id: batches.id }).from(batches)
      .where(and(eq(batches.name, name.trim()), eq(batches.product, product))).get();
    if (existing) throw new ApiException('Batch already exists for this product', 409);

    const [created] = await db.insert(batches).values({
      name:   name.trim(),
      product,
      status: status ?? 'active',
    }).returning();

    return { batch: created };
  });
}

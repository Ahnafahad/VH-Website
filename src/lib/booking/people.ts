/**
 * Who handles which session requests. Instructors are tagged with the
 * product(s) they teach (instructor_products); super admins can handle any.
 */

import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { instructorProducts, users, type UserWithProducts } from '@/lib/db/schema';
import { isStaffRole, isSuperAdminRole } from '@/lib/auth/roles';

export interface Person {
  id: number;
  name: string;
  email: string;
}

export async function getInstructorProducts(userId: number): Promise<string[]> {
  const rows = await db
    .select({ product: instructorProducts.product })
    .from(instructorProducts)
    .where(eq(instructorProducts.userId, userId));
  return rows.map((r) => r.product);
}

/** Can this staff user act on requests for `product`? */
export async function canHandleProduct(user: UserWithProducts, product: string): Promise<boolean> {
  if (!isStaffRole(user.role)) return false;
  if (isSuperAdminRole(user.role)) return true;
  return (await getInstructorProducts(user.id)).includes(product);
}

/** Active instructors tagged for the product; falls back to active super admins if nobody is tagged. */
export async function getEligibleInstructors(product: string): Promise<Person[]> {
  const tagged = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(instructorProducts)
    .innerJoin(users, eq(users.id, instructorProducts.userId))
    .where(and(eq(instructorProducts.product, product), eq(users.status, 'active')));
  if (tagged.length > 0) return tagged;

  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(and(eq(users.role, 'super_admin'), eq(users.status, 'active')));
}

export async function getPeople(ids: number[]): Promise<Map<number, Person>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(inArray(users.id, unique));
  return new Map(rows.map((r) => [r.id, r]));
}

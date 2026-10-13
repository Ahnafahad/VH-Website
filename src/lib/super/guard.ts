/**
 * Super-admin gates. The role is read straight from the DB (not the JWT, not the 60s
 * access-control cache) so a demotion takes effect immediately. Use requireSuperAdmin() in every /api/admin/super/* route and
 * requireSuperAdminPage() in every /admin/super/* server page. Never use isAdminEmail()
 * for these — it admits instructors.
 */
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { ApiException } from '@/lib/api-utils';
import { eq } from 'drizzle-orm';
import { db, users } from '@/lib/db';
import { isSuperAdminRole } from '@/lib/auth/roles';

/** The root account: can never be demoted, suspended, made read-only or removed. */
export const ROOT_EMAIL = 'ahnaf816@gmail.com';

export function isRootEmail(email: string | null | undefined): boolean {
  return (email ?? '').toLowerCase() === ROOT_EMAIL;
}

export interface SuperActor { id: number; email: string; name: string }

async function resolveActor(): Promise<SuperActor | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email || session?.user?.impersonatedBy) return null; // never act as super admin while viewing as someone else
  const user = await db.select({ id: users.id, email: users.email, name: users.name, role: users.role, status: users.status })
    .from(users).where(eq(users.email, email)).get();
  if (!user || !isSuperAdminRole(user.role) || user.status !== 'active') return null;
  return { id: user.id, email: user.email, name: user.name };
}

/** API routes: throws ApiException(401/403); pair with createErrorResponse in the catch. */
export async function requireSuperAdmin(): Promise<SuperActor> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new ApiException('Authentication required', 401, 'AUTH_REQUIRED');
  const actor = await resolveActor();
  if (!actor) throw new ApiException('Super admin only', 403, 'SUPER_ADMIN_ONLY');
  return actor;
}

/** Server pages / layouts: redirects instead of throwing. */
export async function requireSuperAdminPage(): Promise<SuperActor> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');
  const actor = await resolveActor();
  if (!actor) redirect('/admin');
  return actor;
}

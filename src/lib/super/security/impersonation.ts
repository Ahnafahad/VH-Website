import { cookies } from 'next/headers';
import { getUserByEmail, getUserById } from '@/lib/db-access-control';
import { isSuperAdminRole } from '@/lib/auth/roles';
import { VIEW_AS_COOKIE, verifyViewAs } from './view-as';

/**
 * Active "view as" overlay for this request, or null. Valid only if the cookie verifies AND the
 * real signed-in user is the cookie's actor and still an active super_admin.
 */
export async function resolveViewAs(realEmail: string) {
  try {
    const raw = (await cookies()).get(VIEW_AS_COOKIE)?.value;
    if (!raw) return null;
    const p = await verifyViewAs(raw, process.env.NEXTAUTH_SECRET);
    if (!p) return null;
    const actor = await getUserByEmail(realEmail);
    if (!actor || actor.id !== p.a || !isSuperAdminRole(actor.role)) return null;
    const target = await getUserById(p.t);
    if (!target || isSuperAdminRole(target.role)) return null;
    return { target };
  } catch {
    return null; // outside a request scope, or any lookup failure: behave as not impersonating
  }
}

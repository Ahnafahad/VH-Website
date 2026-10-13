import { NextRequest, NextResponse } from 'next/server';
import { and, eq, ne } from 'drizzle-orm';
import { db, users } from '@/lib/db';
import { createErrorResponse, ApiException } from '@/lib/api-utils';
import { requireSuperAdmin, isRootEmail } from '@/lib/super/guard';
import { recordAudit } from '@/lib/audit-log';
import { clearAccessControlCache } from '@/lib/db-access-control';
import { logAuthEvent } from '@/lib/super/security/auth-events';

// POST /api/admin/super/security/force-signout
//   { userId }                      sign one user out everywhere
//   { everyoneExceptMe: true, confirm: 'SIGN OUT EVERYONE' }   sign out all other users (never root)
// Mechanism: users.sessionsInvalidatedAt = now; the NextAuth jwt callback rejects tokens issued earlier.
export async function POST(req: NextRequest) {
  try {
    const actor = await requireSuperAdmin();
    const body = await req.json().catch(() => ({})) as { userId?: unknown; everyoneExceptMe?: unknown; confirm?: unknown };
    const now = new Date();

    if (body.everyoneExceptMe === true) {
      if (body.confirm !== 'SIGN OUT EVERYONE') throw new ApiException('Confirmation phrase required', 400);
      // Root can only be signed out by itself, so skip it unless the actor IS root (then actor is excluded anyway).
      const targets = await db.select({ id: users.id, email: users.email }).from(users).where(ne(users.id, actor.id));
      const affected = targets.filter(t => !isRootEmail(t.email));
      await db.update(users).set({ sessionsInvalidatedAt: now })
        .where(and(ne(users.id, actor.id), ne(users.email, 'ahnaf816@gmail.com')));
      clearAccessControlCache();
      recordAudit({ actorUserId: actor.id, action: 'force_signout_all', entityType: 'user', after: { users: affected.length } }).catch(() => {});
      await logAuthEvent('force_signout', { userId: actor.id, email: actor.email });
      return NextResponse.json({ success: true, affected: affected.length });
    }

    const userId = Number(body.userId);
    if (!Number.isInteger(userId) || userId <= 0) throw new ApiException('userId required', 400);
    const target = await db.select().from(users).where(eq(users.id, userId)).get();
    if (!target) throw new ApiException('User not found', 404);
    if (isRootEmail(target.email) && target.id !== actor.id) throw new ApiException('This account is protected', 403);

    await db.update(users).set({ sessionsInvalidatedAt: now }).where(eq(users.id, userId));
    clearAccessControlCache(target.email);
    recordAudit({ actorUserId: actor.id, action: 'force_signout', entityType: 'user', entityId: userId, after: { email: target.email } }).catch(() => {});
    await logAuthEvent('force_signout', { userId, email: target.email });
    return NextResponse.json({ success: true });
  } catch (error) {
    return createErrorResponse(error);
  }
}

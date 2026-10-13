import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse, ApiException } from '@/lib/api-utils';
import { requireSuperAdmin, isRootEmail } from '@/lib/super/guard';
import { getUserById } from '@/lib/db-access-control';
import { isSuperAdminRole } from '@/lib/auth/roles';
import { recordAudit } from '@/lib/audit-log';
import { logAuthEvent } from '@/lib/super/security/auth-events';
import { VIEW_AS_COOKIE, VIEW_AS_TTL_S, signViewAs, verifyViewAs } from '@/lib/super/security/view-as';

const cookieOpts = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/' };

// POST { userId } -> start viewing as that user (30 min, read-only; enforced in middleware.ts + session callback)
export async function POST(req: NextRequest) {
  try {
    const actor = await requireSuperAdmin(); // fails while already impersonating
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) throw new ApiException('NEXTAUTH_SECRET is not configured', 500);

    const { userId } = await req.json().catch(() => ({})) as { userId?: unknown };
    const id = Number(userId);
    if (!Number.isInteger(id) || id <= 0) throw new ApiException('userId required', 400);
    const target = await getUserById(id);
    if (!target) throw new ApiException('User not found', 404);
    if (isRootEmail(target.email) || isSuperAdminRole(target.role)) {
      throw new ApiException('Cannot view as a super admin', 403);
    }

    const exp = Math.floor(Date.now() / 1000) + VIEW_AS_TTL_S;
    const res = NextResponse.json({ success: true, target: { id: target.id, name: target.name, role: target.role }, expiresAt: exp * 1000 });
    res.cookies.set(VIEW_AS_COOKIE, await signViewAs({ a: actor.id, t: target.id, e: exp }, secret), { ...cookieOpts, maxAge: VIEW_AS_TTL_S });

    recordAudit({ actorUserId: actor.id, action: 'impersonate_start', entityType: 'user', entityId: target.id, after: { email: target.email } }).catch(() => {});
    await logAuthEvent('impersonate_start', { userId: actor.id, email: actor.email });
    return res;
  } catch (error) {
    return createErrorResponse(error);
  }
}

// DELETE -> stop viewing as. The session is the target's while impersonating, so identity comes from the signed cookie.
export async function DELETE(req: NextRequest) {
  try {
    const payload = await verifyViewAs(req.cookies.get(VIEW_AS_COOKIE)?.value, process.env.NEXTAUTH_SECRET);
    const res = NextResponse.json({ success: true });
    res.cookies.set(VIEW_AS_COOKIE, '', { ...cookieOpts, maxAge: 0 });
    if (payload) {
      const actor = await getUserById(payload.a);
      recordAudit({ actorUserId: payload.a, action: 'impersonate_end', entityType: 'user', entityId: payload.t }).catch(() => {});
      await logAuthEvent('impersonate_end', { userId: payload.a, email: actor?.email });
    }
    return res;
  } catch (error) {
    return createErrorResponse(error);
  }
}

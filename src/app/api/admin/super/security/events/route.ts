import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, gte, like, count, type SQL } from 'drizzle-orm';
import { db, authEvents, users } from '@/lib/db';
import { createErrorResponse } from '@/lib/api-utils';
import { requireSuperAdmin, ROOT_EMAIL } from '@/lib/super/guard';
import { findAnomalies } from '@/lib/super/security/anomalies';

// GET /api/admin/super/security/events?type=&user=&limit=
// Recent auth events (+ per-user history via ?user=email-or-name), 24h anomaly hints, super-admin headcount.
export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin();
    const q = req.nextUrl.searchParams;
    const limit = Math.min(Math.max(Number(q.get('limit')) || 100, 1), 500);

    const conds: SQL[] = [];
    const type = q.get('type')?.trim();
    if (type) conds.push(eq(authEvents.type, type));
    const user = q.get('user')?.trim();
    if (user) conds.push(like(authEvents.email, `%${user.toLowerCase()}%`));

    const [events, recent, [sa], superAdmins] = await Promise.all([
      db.select({
        id: authEvents.id, type: authEvents.type, email: authEvents.email, userId: authEvents.userId,
        ip: authEvents.ip, userAgent: authEvents.userAgent, createdAt: authEvents.createdAt,
      }).from(authEvents).where(conds.length ? and(...conds) : undefined).orderBy(desc(authEvents.id)).limit(limit),
      db.select({ type: authEvents.type, email: authEvents.email, ip: authEvents.ip, createdAt: authEvents.createdAt })
        .from(authEvents).where(gte(authEvents.createdAt, new Date(Date.now() - 24 * 3600 * 1000))).limit(5000),
      db.select({ n: count() }).from(users).where(and(eq(users.role, 'super_admin'), eq(users.status, 'active'))),
      db.select({ id: users.id, name: users.name, email: users.email }).from(users)
        .where(and(eq(users.role, 'super_admin'), eq(users.status, 'active'))),
    ]);

    return NextResponse.json({
      events: events.map(e => ({ ...e, createdAt: e.createdAt.getTime() })),
      anomalies: findAnomalies(recent.map(e => ({ ...e, createdAt: e.createdAt.getTime() }))),
      superAdminCount: sa?.n ?? 0,
      superAdmins,
      rootEmail: ROOT_EMAIL,
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}

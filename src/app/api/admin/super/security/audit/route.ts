import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, gte, lt, like, or, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { db, auditLog, users } from '@/lib/db';
import { createErrorResponse } from '@/lib/api-utils';
import { requireSuperAdmin } from '@/lib/super/guard';
import { recordAudit } from '@/lib/audit-log';
import { csvCell } from '@/lib/super/security/diff';

const actorUser = alias(users, 'actor_user');
const PAGE = 50;
const CSV_MAX = 5000;

// GET /api/admin/super/security/audit?actor=&action=&entityType=&entityId=&from=&to=&cursor=&limit=&format=csv
export async function GET(req: NextRequest) {
  try {
    const actor = await requireSuperAdmin();
    const q = req.nextUrl.searchParams;

    const conds: SQL[] = [];
    const actorQ = q.get('actor')?.trim();
    if (actorQ) {
      const n = Number(actorQ);
      conds.push(Number.isInteger(n) ? eq(auditLog.actorUserId, n)
        : or(like(actorUser.email, `%${actorQ}%`), like(actorUser.name, `%${actorQ}%`))!);
    }
    const action = q.get('action')?.trim();
    if (action) conds.push(like(auditLog.action, `${action}%`));
    const entityType = q.get('entityType')?.trim();
    if (entityType) conds.push(eq(auditLog.entityType, entityType));
    const entityId = q.get('entityId')?.trim();
    if (entityId && Number.isInteger(Number(entityId))) conds.push(eq(auditLog.entityId, Number(entityId)));
    const from = q.get('from') ? new Date(q.get('from')!) : null;
    if (from && !isNaN(from.getTime())) conds.push(gte(auditLog.createdAt, from));
    const to = q.get('to') ? new Date(q.get('to')!) : null;
    if (to && !isNaN(to.getTime())) conds.push(lt(auditLog.createdAt, new Date(to.getTime() + 24 * 3600 * 1000))); // `to` includes that whole day
    const csv = q.get('format') === 'csv';
    const cursor = Number(q.get('cursor'));
    if (!csv && Number.isInteger(cursor) && cursor > 0) conds.push(lt(auditLog.id, cursor));

    const limit = csv ? CSV_MAX : Math.min(Math.max(Number(q.get('limit')) || PAGE, 1), 200);
    const rows = await db
      .select({
        id: auditLog.id, action: auditLog.action, entityType: auditLog.entityType, entityId: auditLog.entityId,
        before: auditLog.before, after: auditLog.after, createdAt: auditLog.createdAt,
        actorUserId: auditLog.actorUserId, actorName: actorUser.name, actorEmail: actorUser.email,
      })
      .from(auditLog)
      .leftJoin(actorUser, eq(actorUser.id, auditLog.actorUserId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(auditLog.id))
      .limit(limit + (csv ? 0 : 1));

    if (csv) {
      recordAudit({ actorUserId: actor.id, action: 'audit.export', entityType: 'audit_log', after: { rows: rows.length, filters: Object.fromEntries(q.entries()) } }).catch(() => {});
      const head = ['id', 'time', 'actor', 'actor_email', 'action', 'entity_type', 'entity_id', 'before', 'after'];
      const lines = rows.map(r => [r.id, r.createdAt.toISOString(), r.actorName, r.actorEmail, r.action, r.entityType, r.entityId, r.before, r.after].map(csvCell).join(','));
      return new NextResponse([head.join(','), ...lines].join('\n'), {
        headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="audit-log.csv"' },
      });
    }

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return NextResponse.json({
      rows: page.map(r => ({ ...r, createdAt: r.createdAt.getTime() })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}

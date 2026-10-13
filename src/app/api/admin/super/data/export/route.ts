import { NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { ApiException, createErrorResponse } from '@/lib/api-utils';
import { db, tests } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/super/guard';
import { recordAudit } from '@/lib/audit-log';
import { EXPORTS, EXPORT_MAX_ROWS, countExport, streamExport } from '@/lib/super/data/exports';

export const dynamic = 'force-dynamic';

// GET ?meta=1 -> tests for the marks picker.  GET ?kind=users|marks|registrations|attendance[&testId=] -> text/csv
export async function GET(request: NextRequest) {
  try {
    const actor = await requireSuperAdmin();
    const sp = new URL(request.url).searchParams;
    if (sp.get('meta')) {
      const list = await db.select({ id: tests.id, title: tests.title }).from(tests).orderBy(desc(tests.id));
      return NextResponse.json({ success: true, tests: list });
    }
    const kind = sp.get('kind') ?? '';
    const def = Object.hasOwn(EXPORTS, kind) ? EXPORTS[kind] : undefined;
    if (!def) throw new ApiException('Unknown export kind', 400);
    let arg: number | undefined;
    if (def.needsArg) {
      arg = Number(sp.get('testId'));
      if (!Number.isInteger(arg) || arg <= 0) throw new ApiException('testId required', 400);
    }
    const rows = await countExport(def, arg);
    if (rows > EXPORT_MAX_ROWS) throw new ApiException(`Export too large (${rows} rows, max ${EXPORT_MAX_ROWS})`, 413);
    await recordAudit({ actorUserId: actor.id, action: 'export.csv', entityType: 'export', after: { kind, testId: arg ?? null, rows } });
    return new Response(streamExport(def, arg), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${kind}${arg ? `-${arg}` : ''}-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}

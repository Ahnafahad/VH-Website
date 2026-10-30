/**
 * POST /api/admin/mocks/[id]/omr?apply=1
 * Body: the scanned-OMR JSON (see lib/mocks/omr-import.ts). Without ?apply=1 it is a dry run that
 * only reports what would change. Scanned answers overwrite typed/online ones and are official.
 */

import { NextRequest } from 'next/server';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { recordAudit } from '@/lib/audit-log';
import { importOmr, OmrImportError } from '@/lib/mocks/omr-import';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireStaff();
    const id = parseInt((await params).id, 10);
    const apply = req.nextUrl.searchParams.get('apply') === '1';

    let body: unknown;
    try { body = await req.json(); } catch { throw new ApiException('Body must be JSON', 400); }

    try {
      const report = await importOmr(id, body, apply);
      if (apply) {
        recordAudit({
          actorUserId: user.id, action: 'mock.omr_import', entityType: 'test', entityId: id,
          after: { matched: report.matched, created: report.created, overwritten: report.overwritten },
        }).catch(() => {});
      }
      return report;
    } catch (err) {
      if (err instanceof OmrImportError) throw new ApiException(err.message, 400, 'OMR_IMPORT_INVALID');
      throw err;
    }
  });
}

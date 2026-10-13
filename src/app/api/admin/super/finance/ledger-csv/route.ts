import { NextResponse } from 'next/server';
import { createErrorResponse } from '@/lib/api-utils';
import { requireSuperAdmin } from '@/lib/super/guard';
import { recordAudit } from '@/lib/audit-log';
import { ledgerCsv } from '@/lib/super/finance/ledger';

/** Full ledger export (registration payments + operational entries, all in BDT). Audited. */
export async function GET() {
  try {
    const actor = await requireSuperAdmin();
    const csv = await ledgerCsv();
    await recordAudit({ actorUserId: actor.id, action: 'finance.export', entityType: 'ledger', after: { bytes: csv.length } });
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="ledger-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}

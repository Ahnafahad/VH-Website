import { NextResponse } from 'next/server';
import { createErrorResponse } from '@/lib/api-utils';
import { requireSuperAdmin } from '@/lib/super/guard';
import { recordAudit } from '@/lib/audit-log';
import { buildWeeklyReport } from '@/lib/super/comms/report';
import { gatherReportData, sendWeeklyReport } from '@/lib/super/comms/report-data';

/** GET: preview the report text. POST: send a test report to the root email now. */
export async function GET() {
  try {
    await requireSuperAdmin();
    return NextResponse.json({ text: buildWeeklyReport(await gatherReportData()).text });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function POST() {
  try {
    const actor = await requireSuperAdmin();
    const result = await sendWeeklyReport();
    await recordAudit({ actorUserId: actor.id, action: 'report.send_test', entityType: 'report', after: result });
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    return createErrorResponse(error);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse } from '@/lib/api-utils';
import { requireSuperAdmin } from '@/lib/super/guard';
import { recordAudit } from '@/lib/audit-log';
import { getStorageReport } from '@/lib/super/ops/storage';
import { getThresholds, saveThresholds, thresholdsSchema } from '@/lib/super/ops/thresholds';

export async function GET() {
  try {
    await requireSuperAdmin();
    const [report, thresholds] = await Promise.all([getStorageReport(), getThresholds()]);
    return NextResponse.json({ report, thresholds });
  } catch (error) {
    return createErrorResponse(error);
  }
}

/** Replace the alert thresholds. */
export async function PUT(req: NextRequest) {
  try {
    const actor = await requireSuperAdmin();
    const next = thresholdsSchema.parse(await req.json());
    const before = await getThresholds();
    await saveThresholds(next);
    await recordAudit({ actorUserId: actor.id, action: 'ops.thresholds.update', entityType: 'ops', before, after: next });
    return NextResponse.json({ thresholds: next });
  } catch (error) {
    return createErrorResponse(error);
  }
}

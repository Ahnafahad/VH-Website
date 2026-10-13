import { NextResponse } from 'next/server';
import { createErrorResponse } from '@/lib/api-utils';
import { requireSuperAdmin } from '@/lib/super/guard';
import { recordAudit } from '@/lib/audit-log';
import { getLmsSetting, setLmsSetting } from '@/lib/lms/settings';
import { envHealth } from '@/lib/super/ops/env-health';

const ROTATED_KEY = 'super:ops:turso-token-rotated-at';

export async function GET() {
  try {
    await requireSuperAdmin();
    return NextResponse.json({ env: envHealth(), tursoTokenRotatedAt: await getLmsSetting(ROTATED_KEY) });
  } catch (error) {
    return createErrorResponse(error);
  }
}

/** Manual acknowledgement only; nothing is verified. */
export async function POST() {
  try {
    const actor = await requireSuperAdmin();
    const at = new Date().toISOString();
    await setLmsSetting(ROTATED_KEY, at);
    await recordAudit({ actorUserId: actor.id, action: 'ops.turso-token.ack-rotated', entityType: 'ops', after: { at } });
    return NextResponse.json({ tursoTokenRotatedAt: at });
  } catch (error) {
    return createErrorResponse(error);
  }
}

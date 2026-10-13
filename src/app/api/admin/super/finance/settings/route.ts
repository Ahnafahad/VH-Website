import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiException, createErrorResponse } from '@/lib/api-utils';
import { requireSuperAdmin } from '@/lib/super/guard';
import { recordAudit } from '@/lib/audit-log';
import { setLmsSetting } from '@/lib/lms/settings';
import { isMoneySuperOnly, MONEY_GATE_KEY } from '@/lib/super/finance/money-gate';

export async function GET() {
  try {
    await requireSuperAdmin();
    return NextResponse.json({ moneySuperOnly: await isMoneySuperOnly() });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const actor = await requireSuperAdmin();
    const parsed = z.object({ moneySuperOnly: z.boolean() }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiException('Invalid request', 400);
    const before = await isMoneySuperOnly();
    await setLmsSetting(MONEY_GATE_KEY, parsed.data.moneySuperOnly ? '1' : '0');
    await recordAudit({ actorUserId: actor.id, action: 'finance.money_gate', entityType: 'setting', before: { moneySuperOnly: before }, after: parsed.data });
    return NextResponse.json({ moneySuperOnly: parsed.data.moneySuperOnly });
  } catch (error) {
    return createErrorResponse(error);
  }
}

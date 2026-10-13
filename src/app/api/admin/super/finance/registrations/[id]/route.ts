import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiException, createErrorResponse } from '@/lib/api-utils';
import { requireSuperAdmin } from '@/lib/super/guard';
import { paymentInput, recordPayment, setFollowUp } from '@/lib/super/finance/ledger';

const body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('payment'), ...paymentInput.shape }),
  z.object({ action: z.literal('followup'), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() }),
]);

/** Record a payment/refund, or set/clear the follow-up date. Both are audited in the ledger functions. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSuperAdmin();
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) throw new ApiException('Invalid registration id', 400);
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiException(parsed.error.issues[0]?.message ?? 'Invalid request', 400);

    if (parsed.data.action === 'payment') {
      const { action: _a, ...input } = parsed.data;
      void _a;
      await recordPayment(id, input, actor.id);
    } else {
      await setFollowUp(id, parsed.data.date, actor.id);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return createErrorResponse(error);
  }
}

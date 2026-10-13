import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiException } from '@/lib/api-utils';
import { handle, parseBody } from '@/lib/super/people/route';
import { loadRolloverContext, previewRollover, applyRollover } from '@/lib/super/people/rollover-apply';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handle(async () => {
    const sp = req.nextUrl.searchParams;
    return loadRolloverContext(sp.get('product') ?? 'iba', sp.get('oldBatch') || null);
  });
}

const body = z.object({
  mode: z.enum(['preview', 'apply']), confirm: z.string().optional(),
  product: z.enum(['iba', 'fbs', 'fbs_detailed']), oldBatch: z.string().max(40).nullable(), newBatch: z.string().max(40),
  archiveOld: z.boolean(), copyAccess: z.boolean(), userIds: z.array(z.number().int().positive()).max(2000),
});

export async function POST(req: NextRequest) {
  return handle(async actor => {
    const { mode, confirm, ...r } = await parseBody(req, body);
    if (mode === 'preview') return { plan: await previewRollover(r) };
    if (confirm !== 'ROLLOVER') throw new ApiException('Type ROLLOVER to confirm', 400);
    return { plan: await applyRollover(actor, r) };
  });
}

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiException } from '@/lib/api-utils';
import { handle, parseBody } from '@/lib/super/people/route';
import { mergeAccounts } from '@/lib/super/people/account';

const body = z.object({
  sourceId: z.number().int().positive(), targetId: z.number().int().positive(),
  mode: z.enum(['preview', 'apply']), confirm: z.string().optional(),
});

export async function POST(req: NextRequest) {
  return handle(async actor => {
    const b = await parseBody(req, body);
    if (b.mode === 'apply' && b.confirm !== 'MERGE') throw new ApiException('Type MERGE to confirm', 400);
    return { preview: await mergeAccounts(actor, b.sourceId, b.targetId, b.mode === 'apply') };
  });
}

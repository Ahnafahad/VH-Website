import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiException } from '@/lib/api-utils';
import { handle, parseBody } from '@/lib/super/people/route';
import { adjustPoints, resetWeeklyBoard, undoWeeklyReset, getSnapshot } from '@/lib/super/people/points';

export const dynamic = 'force-dynamic';

const body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('adjust'), userId: z.number().int().positive(), delta: z.number().int(), reason: z.string().max(300) }),
  z.object({ action: z.literal('reset-weekly'), reason: z.string().max(300), confirm: z.string() }),
  z.object({ action: z.literal('undo-reset') }),
]);

export async function GET() {
  return handle(async () => {
    const s = await getSnapshot();
    return { snapshot: s ? { takenAt: s.takenAt, rows: s.rows.length, reason: s.reason } : null };
  });
}

export async function POST(req: NextRequest) {
  return handle(async actor => {
    const b = await parseBody(req, body);
    if (b.action === 'adjust') return { points: await adjustPoints(actor, b.userId, b.delta, b.reason) };
    if (b.action === 'undo-reset') return { result: await undoWeeklyReset(actor) };
    if (b.confirm !== 'RESET') throw new ApiException('Type RESET to confirm', 400);
    return { result: await resetWeeklyBoard(actor, b.reason) };
  });
}

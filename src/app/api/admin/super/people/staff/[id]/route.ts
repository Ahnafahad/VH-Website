import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiException } from '@/lib/api-utils';
import { handle, parseBody } from '@/lib/super/people/route';
import { applyStaffChange } from '@/lib/super/people/staff';
import type { StaffChange } from '@/lib/super/people/guards';

const body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('role'), role: z.string() }),
  z.object({ action: z.literal('suspend') }),
  z.object({ action: z.literal('unsuspend') }),
  z.object({ action: z.literal('readonly'), value: z.boolean() }),
  z.object({ action: z.literal('teaching'), value: z.boolean() }),
  z.object({ action: z.literal('remove') }),
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async actor => {
    const id = parseInt((await params).id, 10);
    if (!Number.isInteger(id)) throw new ApiException('Invalid user id', 400);
    const b = await parseBody(req, body);
    const change: StaffChange = b.action === 'role' ? { kind: 'role', role: b.role }
      : b.action === 'readonly' || b.action === 'teaching' ? { kind: b.action, value: b.value }
      : { kind: b.action };
    return applyStaffChange(actor, id, change);
  });
}

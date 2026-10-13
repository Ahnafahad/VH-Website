import { NextRequest } from 'next/server';
import { z } from 'zod';
import { handle, parseBody } from '@/lib/super/people/route';
import { changeEmail, reassignStudentId } from '@/lib/super/people/account';

const id = z.number().int().positive();
const body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('email'), userId: id, email: z.string().max(200) }),
  z.object({ action: z.literal('studentId'), userId: id, mode: z.enum(['set', 'generate', 'clear']), value: z.string().max(10).optional() }),
]);

export async function POST(req: NextRequest) {
  return handle(async actor => {
    const b = await parseBody(req, body);
    return b.action === 'email'
      ? { result: await changeEmail(actor, b.userId, b.email) }
      : { result: await reassignStudentId(actor, b.userId, b.mode, b.value) };
  });
}

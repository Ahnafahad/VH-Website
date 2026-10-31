/**
 * PATCH /api/admin/mock-registrations/[id]  { action: 'approve' | 'reject', note? }
 * Approve opens 30 days of LexiCore full access, deletes the screenshot and emails the student.
 */

import { NextRequest } from 'next/server';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { isAdminRole } from '@/lib/auth/roles';
import { decideRegistration } from '@/lib/mocks/registration';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireStaff();
    if (!isAdminRole(user.role)) throw new ApiException('Admin access required', 403, 'FORBIDDEN');
    const id = parseInt((await params).id, 10);
    const { action, note } = (await req.json()) as { action?: string; note?: string };
    if (!Number.isInteger(id)) throw new ApiException('Invalid id', 400);
    if (action !== 'approve' && action !== 'reject') throw new ApiException('action must be approve or reject', 400);
    await decideRegistration(id, action, user.id, typeof note === 'string' ? note : undefined);
    return { ok: true };
  });
}

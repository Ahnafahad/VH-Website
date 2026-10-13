import { NextRequest } from 'next/server';
import { ApiException, safeApiHandler } from '@/lib/api-utils';
import { requireOperationalAdmin } from '@/lib/lms/operations-auth';
import { reimburseExpenses } from '@/lib/lms/operations-store';

// POST { ids: number[] } marks those person-paid expenses reimbursed (admin / super_admin only).
export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const admin = await requireOperationalAdmin();
    const body = await req.json().catch(() => { throw new ApiException('Invalid JSON', 400); });
    return reimburseExpenses(body, admin.id);
  });
}

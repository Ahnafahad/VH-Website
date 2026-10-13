import { NextResponse } from 'next/server';
import { createErrorResponse } from '@/lib/api-utils';
import { requireSuperAdmin } from '@/lib/super/guard';
import { getRevenue } from '@/lib/super/finance/ledger';

export async function GET() {
  try {
    await requireSuperAdmin();
    return NextResponse.json(await getRevenue());
  } catch (error) {
    return createErrorResponse(error);
  }
}

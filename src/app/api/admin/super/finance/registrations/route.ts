import { NextResponse } from 'next/server';
import { createErrorResponse } from '@/lib/api-utils';
import { requireSuperAdmin } from '@/lib/super/guard';
import { getPipeline } from '@/lib/super/finance/ledger';

export async function GET() {
  try {
    await requireSuperAdmin();
    return NextResponse.json({ rows: await getPipeline() });
  } catch (error) {
    return createErrorResponse(error);
  }
}

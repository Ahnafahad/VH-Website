import { NextResponse } from 'next/server';
import { createErrorResponse } from '@/lib/api-utils';
import { requireSuperAdmin } from '@/lib/super/guard';
import { runDataChecks } from '@/lib/super/data/checks';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireSuperAdmin();
    return NextResponse.json({ success: true, results: await runDataChecks() });
  } catch (error) {
    return createErrorResponse(error);
  }
}

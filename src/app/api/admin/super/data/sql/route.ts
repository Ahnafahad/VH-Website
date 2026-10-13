import { NextRequest, NextResponse } from 'next/server';
import { ApiException, createErrorResponse } from '@/lib/api-utils';
import { requireSuperAdmin } from '@/lib/super/guard';
import { runReadOnlySql } from '@/lib/super/data/sql-run';
import { validateReadOnlySql } from '@/lib/super/data/sql-validator';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const actor = await requireSuperAdmin();
    const body = (await request.json().catch(() => null)) as { query?: unknown } | null;
    if (typeof body?.query !== 'string') throw new ApiException('query required', 400);
    const check = validateReadOnlySql(body.query);
    if (!check.ok) throw new ApiException(check.reason, 400, 'SQL_REJECTED');
    try {
      return NextResponse.json({ success: true, ...(await runReadOnlySql(body.query, actor.id)) });
    } catch (e) {
      throw new ApiException(e instanceof Error ? e.message : 'Query failed', 400, 'SQL_ERROR');
    }
  } catch (error) {
    return createErrorResponse(error);
  }
}

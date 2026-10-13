import { NextResponse } from 'next/server';
import { createErrorResponse } from '@/lib/api-utils';
import { requireSuperAdmin } from '@/lib/super/guard';
import { expectedSchema, diffSchema } from '@/lib/super/data/schema-drift';
import { readLiveSchema } from '@/lib/super/data/live-schema';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireSuperAdmin();
    const expected = expectedSchema();
    const rows = diffSchema(expected, await readLiveSchema());
    return NextResponse.json({ success: true, tables: Object.keys(expected).length, rows });
  } catch (error) {
    return createErrorResponse(error);
  }
}

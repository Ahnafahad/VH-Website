import { NextResponse } from 'next/server';
import { createErrorResponse } from '@/lib/api-utils';
import { requireSuperAdmin } from '@/lib/super/guard';
import { readLiveSchema } from '@/lib/super/data/live-schema';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireSuperAdmin();
    const live = await readLiveSchema();
    const tables = Object.entries(live)
      .map(([name, t]) => ({ name, columns: t.columns.map(c => ({ name: c.name, type: c.type })) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ success: true, tables });
  } catch (error) {
    return createErrorResponse(error);
  }
}

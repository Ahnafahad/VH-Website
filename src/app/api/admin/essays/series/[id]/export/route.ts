/**
 * GET /api/admin/essays/series/[id]/export — marks as CSV (opens in Excel).
 */

import { NextResponse } from 'next/server';
import { createErrorResponse } from '@/lib/api-utils';
import { parseId, requireEssayStaff } from '@/lib/essays/route-helpers';
import { exportSeriesCsv } from '@/lib/essays/service';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireEssayStaff();
    const { filename, csv } = await exportSeriesCsv(parseId((await params).id));
    return new NextResponse('﻿' + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}

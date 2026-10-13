import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiException, createErrorResponse } from '@/lib/api-utils';
import { requireSuperAdmin } from '@/lib/super/guard';
import { resolveSegment, segmentSchema, type Segment } from '@/lib/super/comms/segment';

const body = z.object({ segment: segmentSchema });

/** Live recipient preview: total count, how many have push, first 20 names. */
export async function POST(req: NextRequest) {
  try {
    await requireSuperAdmin();
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiException('Invalid segment', 400);
    const rows = await resolveSegment(parsed.data.segment as Segment);
    return NextResponse.json({
      count: rows.length,
      pushable: rows.filter(r => r.pushSubscription && r.notifyAnnouncements).length,
      sample: rows.slice(0, 20).map(r => ({ id: r.id, name: r.name, email: r.email, role: r.role, batch: r.batch })),
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}

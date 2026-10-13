import { NextRequest, NextResponse, after } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { broadcasts } from '@/lib/db/schema';
import { ApiException, createErrorResponse } from '@/lib/api-utils';
import { requireSuperAdmin } from '@/lib/super/guard';
import { recordAudit } from '@/lib/audit-log';
import { channelsSchema, resolveSegment, segmentSchema, type Segment } from '@/lib/super/comms/segment';
import { claimAndSend, listBroadcasts, runDueBroadcasts } from '@/lib/super/comms/send';

export const maxDuration = 300; // send-now emails are throttled in small batches

const createBody = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(2000),
  channels: channelsSchema,
  segment: segmentSchema,
  scheduledAt: z.string().datetime({ offset: true }).nullable(), // null = send now
});

export async function GET() {
  try {
    await requireSuperAdmin();
    const list = await listBroadcasts();
    // Hobby crons are daily: also send due scheduled broadcasts when the super admin opens this page (after the response,
    // so the page doesn't wait on email throttling). Atomic claim in runDueBroadcasts prevents double-sends with the cron.
    after(() => runDueBroadcasts().catch(e => console.error('[broadcasts] lazy run failed', e)));
    return NextResponse.json({ broadcasts: list });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireSuperAdmin();
    const parsed = createBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiException(parsed.error.issues[0]?.message ?? 'Invalid broadcast', 400);
    const d = parsed.data;

    const when = d.scheduledAt ? new Date(d.scheduledAt) : new Date();
    if (d.scheduledAt && when.getTime() < Date.now() + 60_000) throw new ApiException('Schedule at least a minute ahead', 400);

    const needsPeople = d.channels.some(c => c !== 'banner');
    if (needsPeople && (await resolveSegment(d.segment as Segment)).length === 0) throw new ApiException('This segment has no recipients', 400);

    const row = await db.insert(broadcasts).values({
      title: d.title, body: d.body, channels: JSON.stringify(d.channels), segment: JSON.stringify(d.segment),
      scheduledAt: when, status: 'scheduled', createdBy: actor.id,
    }).returning({ id: broadcasts.id }).get();
    await recordAudit({ actorUserId: actor.id, action: d.scheduledAt ? 'broadcast.schedule' : 'broadcast.send', entityType: 'broadcast', entityId: row.id,
      after: { title: d.title, channels: d.channels, segment: d.segment, scheduledAt: d.scheduledAt } });

    if (d.scheduledAt) return NextResponse.json({ id: row.id, status: 'scheduled' });
    const result = await claimAndSend(row.id, actor.id);
    return NextResponse.json({ id: row.id, status: result?.error ? 'failed' : 'sent', result });
  } catch (error) {
    return createErrorResponse(error);
  }
}

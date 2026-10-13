import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { broadcasts } from '@/lib/db/schema';
import { ApiException, createErrorResponse } from '@/lib/api-utils';
import { requireSuperAdmin } from '@/lib/super/guard';
import { recordAudit } from '@/lib/audit-log';

/** Cancel a scheduled broadcast (atomic: only while still 'scheduled', so it cannot race the cron). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSuperAdmin();
    const id = Number((await params).id);
    if (!Number.isInteger(id)) throw new ApiException('Invalid id', 400);
    if (!z.object({ action: z.literal('cancel') }).safeParse(await req.json().catch(() => null)).success) throw new ApiException('Unknown action', 400);

    const res = await db.update(broadcasts).set({ status: 'cancelled' }).where(and(eq(broadcasts.id, id), eq(broadcasts.status, 'scheduled')));
    if (((res as unknown as { rowsAffected?: number }).rowsAffected ?? 0) === 0) throw new ApiException('Only scheduled broadcasts can be cancelled', 409);
    await recordAudit({ actorUserId: actor.id, action: 'broadcast.cancel', entityType: 'broadcast', entityId: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return createErrorResponse(error);
  }
}

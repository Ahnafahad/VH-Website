import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { ZodError } from 'zod';
import { ApiException, createErrorResponse } from '@/lib/api-utils';
import { db, users, superPendingActions } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/super/guard';
import { proposeAction } from '@/lib/super/approvals';
import { DANGER_DELAY_MINUTES, parseDangerPayload, previewDanger } from '@/lib/super/data/danger-actions';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const actor = await requireSuperAdmin();
    const rows = await db.select({
      id: superPendingActions.id, action: superPendingActions.action, summary: superPendingActions.summary,
      status: superPendingActions.status, requestedBy: superPendingActions.requestedBy, requester: users.name,
      executeAfter: superPendingActions.executeAfter, resolvedAt: superPendingActions.resolvedAt,
      result: superPendingActions.result, createdAt: superPendingActions.createdAt,
    }).from(superPendingActions).leftJoin(users, eq(superPendingActions.requestedBy, users.id))
      .orderBy(desc(superPendingActions.id)).limit(100);
    return NextResponse.json({ success: true, me: actor.id, rows, serverNow: Date.now() });
  } catch (error) {
    return createErrorResponse(error);
  }
}

// POST { action, payload, confirm?, dryRun? }. dryRun returns the impact preview; otherwise proposes (never executes).
export async function POST(request: NextRequest) {
  try {
    const actor = await requireSuperAdmin();
    const body = (await request.json().catch(() => null)) as { action?: string; payload?: unknown; confirm?: string; dryRun?: boolean } | null;
    if (!body?.action) throw new ApiException('action required', 400);
    let parsed;
    try { parsed = parseDangerPayload(body.action, body.payload); }
    catch (e) { throw new ApiException(e instanceof ZodError ? 'Invalid payload' : (e as Error).message, 400); }

    const preview = await previewDanger(parsed.action, parsed.payload);
    if (body.dryRun) return NextResponse.json({ success: true, preview });
    if (preview.refusal) throw new ApiException(preview.refusal, 422);
    if (body.confirm !== preview.phrase) throw new ApiException('Confirmation phrase does not match', 400);

    const id = await proposeAction({ action: parsed.action, payload: parsed.payload, summary: preview.summary, actorId: actor.id, delayMinutes: DANGER_DELAY_MINUTES });
    return NextResponse.json({ success: true, id, delayMinutes: DANGER_DELAY_MINUTES });
  } catch (error) {
    return createErrorResponse(error);
  }
}

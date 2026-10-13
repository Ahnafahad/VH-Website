import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { ApiException, createErrorResponse } from '@/lib/api-utils';
import { db, superPendingActions } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/super/guard';
import { cancelAction, executeActionNow } from '@/lib/super/approvals';
import '@/lib/super/data/danger-actions'; // registers executors

// POST { op: 'cancel' | 'execute', confirm?: 'EXECUTE NOW' }. Execute is proposer-only.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSuperAdmin();
    const id = parseInt((await params).id, 10);
    if (!Number.isInteger(id)) throw new ApiException('Invalid id', 400);
    const body = (await request.json().catch(() => null)) as { op?: string; confirm?: string } | null;

    if (body?.op === 'cancel') {
      if (!(await cancelAction(id, actor.id))) throw new ApiException('Action is no longer pending', 409);
      return NextResponse.json({ success: true });
    }
    if (body?.op === 'execute') {
      const row = await db.select().from(superPendingActions).where(eq(superPendingActions.id, id)).get();
      if (!row) throw new ApiException('Not found', 404);
      if (row.requestedBy !== actor.id) throw new ApiException('Only the proposer can execute early', 403);
      if (body.confirm !== 'EXECUTE NOW') throw new ApiException('Confirmation phrase does not match', 400);
      const r = await executeActionNow(id);
      if (r === 'skipped') throw new ApiException('Action is no longer pending', 409);
      return NextResponse.json({ success: true, status: r });
    }
    throw new ApiException('op must be cancel or execute', 400);
  } catch (error) {
    return createErrorResponse(error);
  }
}

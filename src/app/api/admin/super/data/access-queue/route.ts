import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { ApiException, createErrorResponse } from '@/lib/api-utils';
import { db, users, vocabAccessRequests, vocabUpgradeRequests } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/super/guard';
import { recordAudit } from '@/lib/audit-log';
import { approveVocabAccessRequest, rejectVocabAccessRequest } from '@/lib/vocab/access-requests';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireSuperAdmin();
    const access = await db.select({
      id: vocabAccessRequests.id, userId: vocabAccessRequests.userId, whatsapp: vocabAccessRequests.whatsapp,
      message: vocabAccessRequests.message, createdAt: vocabAccessRequests.createdAt, name: users.name, email: users.email,
    }).from(vocabAccessRequests).innerJoin(users, eq(vocabAccessRequests.userId, users.id))
      .where(eq(vocabAccessRequests.status, 'pending')).orderBy(desc(vocabAccessRequests.createdAt));
    // Upgrade requests carry no status/handler today: shown read-only as interest signals.
    const upgrades = await db.select({
      id: vocabUpgradeRequests.id, userId: vocabUpgradeRequests.userId, option: vocabUpgradeRequests.selectedOption,
      submittedAt: vocabUpgradeRequests.submittedAt, name: users.name, email: users.email,
    }).from(vocabUpgradeRequests).innerJoin(users, eq(vocabUpgradeRequests.userId, users.id))
      .orderBy(desc(vocabUpgradeRequests.submittedAt)).limit(100);
    return NextResponse.json({ success: true, access, upgrades });
  } catch (error) {
    return createErrorResponse(error);
  }
}

const Body = z.object({ id: z.number().int().positive(), decision: z.enum(['approve', 'deny']) });

export async function POST(request: NextRequest) {
  try {
    const actor = await requireSuperAdmin();
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiException('Invalid body', 400);
    const { id, decision } = parsed.data;
    if (decision === 'approve') await approveVocabAccessRequest(id);
    else await rejectVocabAccessRequest(id);
    await recordAudit({ actorUserId: actor.id, action: `access_request.${decision}`, entityType: 'vocab_access_request', entityId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    return createErrorResponse(error);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, testAttempts, users } from '@/lib/db';
import { createErrorResponse, ApiException } from '@/lib/api-utils';
import { requireSuperAdmin } from '@/lib/super/guard';
import { previewRegrade, applyRegrade } from '@/lib/super/content/regrade';
import { voidAttempt, unvoidAttempt } from '@/lib/super/content/void';
import { listVersions, restoreVersion } from '@/lib/super/content/versions';

function parseId(raw: string): number {
  const id = parseInt(raw, 10);
  if (!Number.isFinite(id)) throw new ApiException('Invalid test id', 400);
  return id;
}

/** Attempts (with void state) + version history for one test. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin();
    const testId = parseId((await params).id);
    const rows = await db.select({ a: testAttempts, name: users.name, email: users.email })
      .from(testAttempts).innerJoin(users, eq(users.id, testAttempts.userId))
      .where(eq(testAttempts.testId, testId));
    const attempts = rows
      .filter(r => r.a.status === 'submitted' || (r.a.status === 'banned' && r.a.submittedAt))
      .map(r => ({
        id: r.a.id, name: r.name, email: r.email, score: r.a.totalScore,
        voided: r.a.status === 'banned',
      }))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return NextResponse.json({ attempts, versions: await listVersions(testId) });
  } catch (error) {
    return createErrorResponse(error);
  }
}

const body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('regrade-preview') }),
  z.object({ action: z.literal('regrade-apply'), confirm: z.string() }),
  z.object({ action: z.literal('void'), attemptId: z.number().int(), reason: z.string().min(3).max(500) }),
  z.object({ action: z.literal('unvoid'), attemptId: z.number().int() }),
  z.object({ action: z.literal('restore'), versionId: z.number().int(), confirm: z.string() }),
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSuperAdmin();
    const testId = parseId((await params).id);
    const parsed = body.safeParse(await req.json());
    if (!parsed.success) throw new ApiException('Invalid body', 400);
    const b = parsed.data;

    switch (b.action) {
      case 'regrade-preview':
        return NextResponse.json(await previewRegrade(testId));
      case 'regrade-apply':
        if (b.confirm !== 'REGRADE') throw new ApiException('Type REGRADE to confirm', 400);
        return NextResponse.json(await applyRegrade(testId, actor.id));
      case 'void': {
        await assertAttemptInTest(b.attemptId, testId);
        await voidAttempt(b.attemptId, b.reason, actor.id);
        return NextResponse.json({ ok: true });
      }
      case 'unvoid':
        await assertAttemptInTest(b.attemptId, testId);
        await unvoidAttempt(b.attemptId, actor.id);
        return NextResponse.json({ ok: true });
      case 'restore':
        if (b.confirm !== 'RESTORE') throw new ApiException('Type RESTORE to confirm', 400);
        return NextResponse.json(await restoreVersion(testId, b.versionId, actor.id));
    }
  } catch (error) {
    return createErrorResponse(error);
  }
}

async function assertAttemptInTest(attemptId: number, testId: number) {
  const a = await db.select({ testId: testAttempts.testId }).from(testAttempts).where(eq(testAttempts.id, attemptId)).get();
  if (!a || a.testId !== testId) throw new ApiException('Attempt not found for this test', 404);
}

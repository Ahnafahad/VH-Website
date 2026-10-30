/**
 * PATCH /api/admin/mocks/[id]
 * Staff-only mock settings. Publishing/unpublishing results, status and windows use the existing
 * /api/admin/tests endpoints.
 * Body: { isMock?, mockBatch?, examCode?, essaySeriesId?, solutionPdfKey? }
 * Turning a test into a mock also restricts it to the IBA product when it had no restriction.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tests, essaySeries } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { recordAudit } from '@/lib/audit-log';

const bodySchema = z.object({
  isMock: z.boolean().optional(),
  mockBatch: z.string().trim().min(1).max(40).nullable().optional(),
  examCode: z.string().trim().min(1).max(40).nullable().optional(),
  essaySeriesId: z.number().int().positive().nullable().optional(),
  solutionPdfKey: z.string().max(300).nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireStaff();
    const id = parseInt((await params).id, 10);
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiException('Invalid body', 400);
    const b = parsed.data;

    const test = await db.select().from(tests).where(eq(tests.id, id)).get();
    if (!test) throw new ApiException('Test not found', 404);
    if (b.essaySeriesId) {
      const series = await db.select({ id: essaySeries.id }).from(essaySeries).where(eq(essaySeries.id, b.essaySeriesId)).get();
      if (!series) throw new ApiException('Essay series not found', 404);
    }

    await db.update(tests).set({
      ...(b.isMock !== undefined ? { isMock: b.isMock } : {}),
      ...(b.isMock && !test.allowedProducts ? { allowedProducts: JSON.stringify(['iba']) } : {}),
      ...(b.mockBatch !== undefined ? { mockBatch: b.mockBatch } : {}),
      ...(b.examCode !== undefined ? { examCode: b.examCode } : {}),
      ...(b.essaySeriesId !== undefined ? { essaySeriesId: b.essaySeriesId } : {}),
      ...(b.solutionPdfKey !== undefined ? { solutionPdfKey: b.solutionPdfKey } : {}),
      updatedAt: new Date(),
    }).where(eq(tests.id, id));

    recordAudit({
      actorUserId: user.id, action: 'mock.update', entityType: 'test', entityId: id,
      before: { isMock: test.isMock, mockBatch: test.mockBatch, examCode: test.examCode, essaySeriesId: test.essaySeriesId },
      after: b,
    }).catch(() => {});

    return { updated: true };
  });
}

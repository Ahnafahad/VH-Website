/**
 * GET  /api/admin/marathon/assignments — list every chapter→batch assignment.
 * POST /api/admin/marathon/assignments — assign a chapter to a product/batch
 *   starting on a given date. Body: { chapterId, product, batch, startDate }.
 *   batch: null = every student on that product.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser, requireMarathonStaff } from '@/lib/marathon/route-helpers';
import { createAssignment, listAssignmentsWithChapter } from '@/lib/marathon/service';

export async function GET() {
  return safeApiHandler(async () => {
    const user = await requireUser();
    await requireMarathonStaff(user);
    const rows = await listAssignmentsWithChapter();
    return {
      assignments: rows.map(({ assignment, chapter }) => ({
        id: assignment.id,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        product: assignment.product,
        batch: assignment.batch,
        startDate: assignment.startDate.getTime(),
      })),
    };
  });
}

const bodySchema = z.object({
  chapterId: z.number().int().positive(),
  product: z.string().min(1),
  batch: z.string().min(1).nullable(),
  startDate: z.number().int().positive(), // epoch ms, local midnight of Day 1
});

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    await requireMarathonStaff(user);
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiException('Invalid body', 400);
    const { chapterId, product, batch, startDate } = parsed.data;
    const created = await createAssignment({
      chapterId, product, batch, startDate: new Date(startDate), assignedBy: user.id,
    });
    return { assignment: { id: created.id } };
  });
}

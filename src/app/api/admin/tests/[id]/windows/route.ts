/**
 * POST /api/admin/tests/[id]/windows
 * Staff (admin/instructor): schedule a sitting of a test.
 * Body: { mode: 'online'|'offline', opensAt: number (epoch ms),
 *         closesAt: number, durationMinutes?: number }
 * Online windows require durationMinutes; offline windows are the entry slot.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tests, testWindows } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';

const bodySchema = z.object({
  mode: z.enum(['online', 'offline']),
  opensAt: z.number().int().positive(),
  closesAt: z.number().int().positive(),
  durationMinutes: z.number().int().positive().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    const staff = await requireStaff();
    const id = parseInt((await params).id, 10);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiException('Invalid body', 400);
    const { mode, opensAt, closesAt, durationMinutes } = parsed.data;

    if (closesAt <= opensAt) throw new ApiException('closesAt must be after opensAt', 400);
    if (mode === 'online' && !durationMinutes) {
      throw new ApiException('Online windows require durationMinutes', 400);
    }

    const test = await db.select().from(tests).where(eq(tests.id, id)).get();
    if (!test) throw new ApiException('Test not found', 404);

    const [created] = await db.insert(testWindows).values({
      testId: id,
      mode,
      opensAt: new Date(opensAt),
      closesAt: new Date(closesAt),
      durationMinutes: mode === 'online' ? durationMinutes : null,
      status: 'scheduled',
      createdBy: staff.id,
    }).returning();

    return { windowId: created.id };
  });
}

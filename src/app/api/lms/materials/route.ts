/**
 * GET /api/lms/materials
 * Scope-filtered list of materials. Optional ?classSessionId=<id>.
 */

import { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { materials } from '@/lib/db/schema';
import { safeApiHandler } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { lmsScopeConditions } from '@/lib/lms/access';
import { getGatedSolutionMaterialIds } from '@/lib/lms/homework-access';
import { resolveFileUrl } from '@/lib/storage/r2';

export async function GET(req: NextRequest) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const scope = lmsScopeConditions(user, materials);

    const url = new URL(req.url);
    const sessionIdParam = url.searchParams.get('classSessionId');

    const conditions = [...scope];
    if (sessionIdParam) {
      const sessionId = parseInt(sessionIdParam, 10);
      if (isNaN(sessionId)) {
        throw { message: 'Invalid classSessionId', status: 400 };
      }
      conditions.push(eq(materials.classSessionId, sessionId));
    }

    const rows = await db
      .select()
      .from(materials)
      .where(and(...conditions));

    const gatedIds = await getGatedSolutionMaterialIds(user, rows.map((r) => r.id));
    const visibleRows = rows.filter((r) => !gatedIds.has(r.id));

    return Promise.all(
      visibleRows.map(async (m) => ({
        id: m.id,
        title: m.title,
        type: m.type,
        blobUrl: (await resolveFileUrl(m.blobUrl)) ?? '',
        fileName: m.fileName,
        fileSize: m.fileSize,
        subject: m.subject,
        product: m.product,
        batch: m.batch,
        classSessionId: m.classSessionId,
        createdAt: m.createdAt.getTime(),
      })),
    );
  });
}

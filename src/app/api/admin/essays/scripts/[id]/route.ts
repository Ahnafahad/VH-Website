/**
 * GET   /api/admin/essays/scripts/[id] — one script: pages + markings, marks, notes, history.
 * PATCH /api/admin/essays/scripts/[id] — save marks/feedback.
 *   Body: { marks?, sectionComments?, overallFeedback?, privateNote?, action: 'save' | 'grade', notify?: boolean }
 */

import { NextRequest } from 'next/server';
import { safeApiHandler } from '@/lib/api-utils';
import { parseId, requireEssayStaff } from '@/lib/essays/route-helpers';
import { getScriptForStaff, saveMarks } from '@/lib/essays/service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return safeApiHandler(async () => {
    await requireEssayStaff();
    return getScriptForStaff(parseId((await params).id));
  });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  return safeApiHandler(async () => {
    const user = await requireEssayStaff();
    return saveMarks(parseId((await params).id), user, await req.json());
  });
}

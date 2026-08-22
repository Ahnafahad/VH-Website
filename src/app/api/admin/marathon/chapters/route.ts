/**
 * GET /api/admin/marathon/chapters
 * Lists all marathon chapters (draft + published) for the admin assignment UI.
 */

import { safeApiHandler } from '@/lib/api-utils';
import { requireUser, requireMarathonStaff } from '@/lib/marathon/route-helpers';
import { listAllChapters } from '@/lib/marathon/service';

export async function GET() {
  return safeApiHandler(async () => {
    const user = await requireUser();
    await requireMarathonStaff(user);
    const chapters = await listAllChapters();
    return {
      chapters: chapters.map(c => ({
        id: c.id, slug: c.slug, title: c.title, subject: c.subject, product: c.product,
        totalDays: c.totalDays, questionsPerDay: c.questionsPerDay, status: c.status,
      })),
    };
  });
}

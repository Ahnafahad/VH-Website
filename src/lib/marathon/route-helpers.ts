/**
 * Shared request-scope helpers for /api/marathon and /api/admin/marathon routes.
 * requireUser/requireStaff are generic auth helpers (not test-specific) reused
 * from the tests module rather than duplicated.
 */

import { ApiException } from '@/lib/api-utils';
import type { UserWithProducts, MarathonChapter, MarathonDay } from '@/lib/db/schema';
import { isMarathonStaff, assignmentMatchesUser } from './access';
import { getChapterBySlug, getAssignmentsForChapter, getDayByNumber } from './service';
import { earliestStartDate, effectiveDayState } from './unlock';
import { isUltimateTesterEmail } from '@/lib/auth/roles';

export { requireUser } from '@/lib/tests/route-helpers';

export async function requireMarathonStaff(user: UserWithProducts): Promise<void> {
  if (!isMarathonStaff(user)) {
    throw new ApiException('Instructor or admin access required', 403, 'FORBIDDEN');
  }
}

export async function requireChapterForUser(slug: string, user: UserWithProducts) {
  const bypass = isMarathonStaff(user) || isUltimateTesterEmail(user.email);
  const chapter = await getChapterBySlug(slug);
  if (!chapter || chapter.status !== 'published') {
    if (!(chapter && bypass)) {
      throw new ApiException('Marathon chapter not found', 404, 'CHAPTER_NOT_FOUND');
    }
  }
  const assignments = await getAssignmentsForChapter(chapter!.id);
  const mine = assignments.filter(a => assignmentMatchesUser(a, user));
  if (mine.length === 0 && !bypass) {
    throw new ApiException('You do not have access to this marathon', 403, 'MARATHON_ACCESS_DENIED');
  }
  return { chapter: chapter!, assignments: mine };
}

/**
 * Resolves a chapter + day for a student, enforcing the calendar unlock.
 * Staff bypass the lock (so they can preview upcoming days).
 */
export async function requireUnlockedDayForUser(
  slug: string, dayNumber: number, user: UserWithProducts,
): Promise<{ chapter: MarathonChapter; day: MarathonDay }> {
  const { chapter, assignments } = await requireChapterForUser(slug, user);
  const day = await getDayByNumber(chapter.id, dayNumber);
  if (!day) throw new ApiException('Day not found', 404, 'DAY_NOT_FOUND');

  if (!isMarathonStaff(user) && !isUltimateTesterEmail(user.email)) {
    const startDate = earliestStartDate(assignments.map(a => a.startDate));
    if (!startDate || effectiveDayState(startDate, day.dayNumber) === 'locked') {
      throw new ApiException('This day has not unlocked yet', 403, 'DAY_LOCKED');
    }
  }
  return { chapter, day };
}

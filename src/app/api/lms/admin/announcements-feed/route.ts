/**
 * GET  /api/lms/admin/announcements-feed — list all LMS announcements
 * POST /api/lms/admin/announcements-feed — create an announcement
 */

import { NextRequest } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { lmsAnnouncements } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { LMS_SUBJECTS } from '@/lib/lms/constants';
import { notifyStudentsForContent } from '@/lib/notifications/push';
import { encodeTargetUserIds, parseTargetUserIds, resolveTargetUsers, type TargetUser } from '@/lib/lms/announcement-targets';

export async function GET() {
  return safeApiHandler(async () => {
    await requireStaff();
    const rows = await db
      .select()
      .from(lmsAnnouncements)
      .orderBy(desc(lmsAnnouncements.pinned), desc(lmsAnnouncements.createdAt));

    // Resolve every row's targeted individuals in one batch query rather than
    // one lookup per row.
    const allIds = [...new Set(rows.flatMap(r => parseTargetUserIds(r.targetUserIds)))];
    const resolved = await resolveTargetUsers(db, allIds);
    const userMap = new Map(resolved.map(u => [u.id, u]));

    return rows.map(a => serializeAnnouncement(a, orderedTargets(a.targetUserIds, userMap)));
  });
}

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const staff = await requireStaff();
    const body = await req.json();

    const { title, body: bodyText, subject, product, batch, pinned, targetUserIds } = body;

    if (!title || typeof title !== 'string') throw new ApiException('title is required', 400);
    if (!bodyText || typeof bodyText !== 'string') throw new ApiException('body is required', 400);
    if (!subject || !(LMS_SUBJECTS as readonly string[]).includes(subject)) {
      throw new ApiException(`subject must be one of: ${LMS_SUBJECTS.join(', ')}`, 400);
    }
    if (!product || typeof product !== 'string') throw new ApiException('product is required', 400);

    const encodedTargets = encodeTargetUserIds(targetUserIds);

    const [created] = await db
      .insert(lmsAnnouncements)
      .values({
        title,
        body: bodyText,
        subject,
        product,
        batch: batch ?? null,
        targetUserIds: encodedTargets,
        pinned: pinned === true,
        createdBy: staff.id,
      })
      .returning();

    // Fire-and-forget push to students who can see this announcement. Swallow
    // all errors — a push failure must never turn a successful create into a 500.
    try {
      await notifyStudentsForContent(db, {
        product:  created.product,
        batch:    created.batch,
        // Individually targeted announcements notify only their targets — the
        // rest of the batch can't see the announcement, so must not be pinged.
        targetUserIds: parseTargetUserIds(created.targetUserIds),
        category: 'announcements',
        title:    created.title,
        body:     created.body.slice(0, 120),
        url:      '/dashboard',
      });
    } catch { /* swallow — never fail the create because of push */ }

    const targetUsers = await resolveTargetUsers(db, parseTargetUserIds(encodedTargets));
    return serializeAnnouncement(created, targetUsers.length > 0 ? targetUsers : null);
  });
}

/** Resolved target users in the order stored, or null when cohort-targeted. */
function orderedTargets(raw: string | null, userMap: Map<number, TargetUser>): TargetUser[] | null {
  const ids = parseTargetUserIds(raw);
  if (ids.length === 0) return null;
  return ids.map(id => userMap.get(id)).filter((u): u is TargetUser => u !== undefined);
}

function serializeAnnouncement(a: typeof lmsAnnouncements.$inferSelect, targetUsers: TargetUser[] | null) {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    subject: a.subject,
    product: a.product,
    batch: a.batch,
    targetUsers,
    pinned: a.pinned,
    createdBy: a.createdBy,
    createdAt: a.createdAt.getTime(),
  };
}

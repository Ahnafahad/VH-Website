/**
 * PATCH  /api/lms/admin/announcements-feed/[id] — update an announcement
 * DELETE /api/lms/admin/announcements-feed/[id] — delete an announcement
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { lmsAnnouncements } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { LMS_SUBJECTS } from '@/lib/lms/constants';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    await requireStaff();
    const { id } = await params;
    const announcementId = parseInt(id, 10);
    if (isNaN(announcementId)) throw new ApiException('Invalid id', 400);

    const existing = await db
      .select()
      .from(lmsAnnouncements)
      .where(eq(lmsAnnouncements.id, announcementId))
      .get();
    if (!existing) throw new ApiException('Announcement not found', 404);

    const body = await req.json();
    const updates: Partial<typeof lmsAnnouncements.$inferInsert> = {};

    if (body.title !== undefined) {
      if (typeof body.title !== 'string') throw new ApiException('title must be a string', 400);
      updates.title = body.title;
    }
    if (body.body !== undefined) {
      if (typeof body.body !== 'string') throw new ApiException('body must be a string', 400);
      updates.body = body.body;
    }
    if (body.subject !== undefined) {
      if (!(LMS_SUBJECTS as readonly string[]).includes(body.subject)) {
        throw new ApiException(`subject must be one of: ${LMS_SUBJECTS.join(', ')}`, 400);
      }
      updates.subject = body.subject;
    }
    if (body.product !== undefined) updates.product = body.product;
    if (body.batch !== undefined) updates.batch = body.batch ?? null;
    if (body.pinned !== undefined) updates.pinned = Boolean(body.pinned);

    if (Object.keys(updates).length === 0) throw new ApiException('No fields to update', 400);

    const [updated] = await db
      .update(lmsAnnouncements)
      .set(updates)
      .where(eq(lmsAnnouncements.id, announcementId))
      .returning();

    return {
      id: updated.id,
      title: updated.title,
      body: updated.body,
      subject: updated.subject,
      product: updated.product,
      batch: updated.batch,
      pinned: updated.pinned,
      createdAt: updated.createdAt.getTime(),
    };
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    await requireStaff();
    const { id } = await params;
    const announcementId = parseInt(id, 10);
    if (isNaN(announcementId)) throw new ApiException('Invalid id', 400);

    const existing = await db
      .select()
      .from(lmsAnnouncements)
      .where(eq(lmsAnnouncements.id, announcementId))
      .get();
    if (!existing) throw new ApiException('Announcement not found', 404);

    await db
      .delete(lmsAnnouncements)
      .where(eq(lmsAnnouncements.id, announcementId));

    return { deleted: true };
  });
}

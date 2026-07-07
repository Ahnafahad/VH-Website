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

export async function GET() {
  return safeApiHandler(async () => {
    await requireStaff();
    const rows = await db
      .select()
      .from(lmsAnnouncements)
      .orderBy(desc(lmsAnnouncements.pinned), desc(lmsAnnouncements.createdAt));
    return rows.map(serializeAnnouncement);
  });
}

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const staff = await requireStaff();
    const body = await req.json();

    const { title, body: bodyText, subject, product, batch, pinned } = body;

    if (!title || typeof title !== 'string') throw new ApiException('title is required', 400);
    if (!bodyText || typeof bodyText !== 'string') throw new ApiException('body is required', 400);
    if (!subject || !(LMS_SUBJECTS as readonly string[]).includes(subject)) {
      throw new ApiException(`subject must be one of: ${LMS_SUBJECTS.join(', ')}`, 400);
    }
    if (!product || typeof product !== 'string') throw new ApiException('product is required', 400);

    const [created] = await db
      .insert(lmsAnnouncements)
      .values({
        title,
        body: bodyText,
        subject,
        product,
        batch: batch ?? null,
        pinned: pinned === true,
        createdBy: staff.id,
      })
      .returning();

    return serializeAnnouncement(created);
  });
}

function serializeAnnouncement(a: typeof lmsAnnouncements.$inferSelect) {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    subject: a.subject,
    product: a.product,
    batch: a.batch,
    pinned: a.pinned,
    createdBy: a.createdBy,
    createdAt: a.createdAt.getTime(),
  };
}

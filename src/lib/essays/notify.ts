/**
 * Essay notifications — push (when the student has a site-wide subscription
 * and announcement notifications on) plus email. Always fire-and-forget:
 * callers wrap these in `after()` so a slow mail provider never blocks marking.
 */

import { inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { sendEssayNotice } from '@/lib/email';
import { sendPushToUser } from '@/lib/notifications/push';

const BASE_URL = (process.env.NEXTAUTH_URL ?? 'https://www.vh-beyondthehorizons.org').replace(/\/$/, '');

export interface EssayNotice {
  subject: string;
  heading: string;
  message: string;
  path: string; // e.g. '/essays/3'
  ctaLabel: string;
}

export async function notifyStudents(userIds: number[], notice: EssayNotice): Promise<void> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;
  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name, push: users.pushSubscription, pref: users.notifyAnnouncements })
    .from(users)
    .where(inArray(users.id, ids));

  const url = `${BASE_URL}${notice.path}`;
  const CHUNK = 10;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await Promise.allSettled(
      rows.slice(i, i + CHUNK).flatMap(r => [
        sendEssayNotice(r.email, notice.subject, {
          name: r.name.split(' ')[0] || r.name,
          heading: notice.heading,
          message: notice.message,
          ctaLabel: notice.ctaLabel,
          ctaUrl: url,
        }),
        ...(r.push && r.pref ? [sendPushToUser(r.push, { title: notice.heading, body: notice.message, url: notice.path })] : []),
      ]),
    );
  }
}

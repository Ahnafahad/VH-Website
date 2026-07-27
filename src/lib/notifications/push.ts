/**
 * push.ts — Server-side site-wide push notification utility.
 *
 * Generalises the LexiCore-only vocab push (src/lib/vocab/push-notify.ts) to
 * reach ALL students, using the site-wide subscription stored on users.
 *
 * Used by:
 *   - /api/notifications/*           (student subscribe / unsubscribe / prefs)
 *   - LMS material + announcement create triggers (fire-and-forget)
 *
 * VAPID keys MUST be set in environment variables:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY   — safe to expose to the browser
 *   VAPID_PRIVATE_KEY              — server-side only, NEVER sent to client
 */

import webpush from 'web-push';
import { and, eq, isNotNull } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type * as schema from '@/lib/db/schema';
import { users, userAccess } from '@/lib/db/schema';
import { lmsStudentAudienceConditions } from '@/lib/lms/access';

// ─── VAPID initialisation ────────────────────────────────────────────────────

const VAPID_PUBLIC  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? '';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(
    'mailto:admin@vh.edu.bd',
    VAPID_PUBLIC,
    VAPID_PRIVATE,
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type DrizzleClient = LibSQLDatabase<typeof schema>;

export type NotifyCategory = 'materials' | 'announcements' | 'commentReply';

// ─── sendPushToUser ───────────────────────────────────────────────────────────

/**
 * Sends a single push notification to one user's site-wide subscription.
 *
 * @param subscriptionJson  Serialised PushSubscriptionJSON string from DB.
 * @param payload           { title, body, url } — url is opened on click.
 * @returns                 true on success, false on failure (410/404 = expired).
 */
export async function sendPushToUser(
  subscriptionJson: string,
  payload: { title: string; body: string; url: string },
): Promise<boolean> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.warn('[notifications/push] VAPID keys not configured — skipping push send');
    return false;
  }

  let subscription: webpush.PushSubscription;
  try {
    subscription = JSON.parse(subscriptionJson) as webpush.PushSubscription;
  } catch {
    console.error('[notifications/push] Failed to parse push subscription JSON');
    return false;
  }

  const body = JSON.stringify(payload);

  try {
    await webpush.sendNotification(subscription, body);
    return true;
  } catch (err) {
    // 410 Gone = subscription expired / user unsubscribed in browser
    // 404 Not Found = subscription no longer valid
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 410 || status === 404) {
      console.warn('[notifications/push] Subscription expired or gone (status ' + String(status) + ')');
    } else {
      console.error('[notifications/push] sendNotification error:', err);
    }
    return false;
  }
}

// ─── notifyStudentsForContent ─────────────────────────────────────────────────

/**
 * Sends a push to every active student who can see the given content scope and
 * has the matching category preference enabled.
 *
 * Recipient rule is NOT re-encoded here — the audience comes from
 * `lmsStudentAudienceConditions` (lib/lms/access.ts), the same seam that backs
 * `canAccessLmsContent` / `lmsScopeConditions`. This function only adds the two
 * notification-specific filters on top: a site-wide pushSubscription must be
 * set, and the category preference column must be true.
 *
 * Expired subscriptions (send returns false) are nulled out and counted.
 */
export async function notifyStudentsForContent(
  db: DrizzleClient,
  args: {
    product: string;
    batch: string | null;
    category: NotifyCategory;
    title: string;
    body: string;
    url: string;
  },
): Promise<{ sent: number; failed: number; cleaned: number }> {
  const prefColumn =
    args.category === 'materials'     ? users.notifyMaterials
    : args.category === 'announcements' ? users.notifyAnnouncements
    : users.notifyCommentReply;

  // Audience (who can SEE this content) comes from the LMS access seam so the
  // rule is not re-encoded here; the two extra conditions are notification
  // concerns only — they narrow the audience, they never widen it.
  const conditions = [
    ...lmsStudentAudienceConditions({ product: args.product, batch: args.batch }),
    isNotNull(users.pushSubscription),
    eq(prefColumn, true),
  ];

  const rows = await db
    .select({ userId: users.id, pushSubscription: users.pushSubscription })
    .from(users)
    .innerJoin(userAccess, eq(userAccess.userId, users.id))
    .where(and(...conditions));

  // Deduplicate: a user may hold multiple userAccess rows.
  const recipients = new Map<number, string>();
  for (const row of rows) {
    if (row.pushSubscription) recipients.set(row.userId, row.pushSubscription);
  }

  let sent    = 0;
  let failed  = 0;
  let cleaned = 0;

  // Only prune subscriptions when VAPID is actually configured — otherwise a
  // local run with no keys fails every send and would wipe all subscriptions.
  const vapidConfigured = Boolean(VAPID_PUBLIC && VAPID_PRIVATE);

  for (const [userId, subscription] of recipients) {
    const ok = await sendPushToUser(subscription, {
      title: args.title,
      body:  args.body,
      url:   args.url,
    });
    if (ok) {
      sent++;
    } else {
      failed++;
      if (vapidConfigured) {
        // Null out expired / invalid subscriptions so we stop retrying them.
        await db
          .update(users)
          .set({ pushSubscription: null })
          .where(eq(users.id, userId))
          .catch(() => {});
        cleaned++;
      }
    }
  }

  return { sent, failed, cleaned };
}

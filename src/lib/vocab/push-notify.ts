/**
 * push-notify.ts — Server-side push notification utility for LexiCore.
 *
 * Used by:
 *   - /api/vocab/push/send          (admin broadcast / targeted send)
 *   - Future cron jobs (streak reminders, weekly summaries)
 *
 * VAPID keys MUST be set in environment variables before this module is used:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY   — safe to expose to the browser
 *   VAPID_PRIVATE_KEY              — server-side only, NEVER sent to client
 */

import webpush from 'web-push';
import { isNotNull, eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type * as schema from '@/lib/db/schema';
import { vocabUserProgress } from '@/lib/db/schema';

// ─── VAPID initialisation ────────────────────────────────────────────────────
// setVapidDetails is called lazily the first time this module is imported on
// the server. Keys are read from env at module load time.

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

// ─── sendPushToUser ───────────────────────────────────────────────────────────

/**
 * Sends a single push notification to one user.
 *
 * @param pushSubscriptionJson  Serialised PushSubscriptionJSON string from DB.
 * @param title                 Notification title shown in the OS.
 * @param body                  Notification body text.
 * @param url                   URL to open on click. Defaults to /vocab.
 * @returns                     true on success, false on failure (errors are
 *                              caught and logged silently so callers can batch).
 */
/**
 * Callback to clean up expired subscriptions.
 * Set by sendPushToAllSubscribed to delete stale rows from DB.
 */
type CleanupCallback = (userId: number) => Promise<void>;
let _cleanupCallback: CleanupCallback | null = null;

export async function sendPushToUser(
  pushSubscriptionJson: string,
  title: string,
  body: string,
  url = '/vocab',
  userId?: number,
): Promise<boolean> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.warn('[push-notify] VAPID keys not configured — skipping push send');
    return false;
  }

  let subscription: webpush.PushSubscription;
  try {
    subscription = JSON.parse(pushSubscriptionJson) as webpush.PushSubscription;
  } catch {
    console.error('[push-notify] Failed to parse push subscription JSON');
    return false;
  }

  const payload = JSON.stringify({ title, body, url });

  try {
    await webpush.sendNotification(subscription, payload);
    return true;
  } catch (err) {
    // 410 Gone = subscription expired / user unsubscribed in browser
    // 404 Not Found = subscription no longer valid
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 410 || status === 404) {
      console.warn('[push-notify] Subscription expired or gone (status ' + String(status) + ') — cleaning up');
      if (userId !== undefined && _cleanupCallback) {
        await _cleanupCallback(userId).catch(() => {});
      }
    } else {
      console.error('[push-notify] sendNotification error:', err);
    }
    return false;
  }
}

// ─── sendPushToAllSubscribed ──────────────────────────────────────────────────

/**
 * Broadcasts a push notification to every user who has an active subscription.
 *
 * @param db     Drizzle client (import from src/lib/db/index.ts).
 * @param title  Notification title.
 * @param body   Notification body text.
 * @param url    URL to open on click. Defaults to /vocab.
 * @returns      Object with { sent, failed } counts.
 */
export async function sendPushToAllSubscribed(
  db: DrizzleClient,
  title: string,
  body: string,
  url = '/vocab',
): Promise<{ sent: number; failed: number; cleaned: number }> {
  const rows = await db
    .select({ userId: vocabUserProgress.userId, pushSubscription: vocabUserProgress.pushSubscription })
    .from(vocabUserProgress)
    .where(isNotNull(vocabUserProgress.pushSubscription));

  let sent    = 0;
  let failed  = 0;
  let cleaned = 0;

  // Set up cleanup callback to remove expired subscriptions
  _cleanupCallback = async (userId: number) => {
    await db.update(vocabUserProgress)
      .set({ pushSubscription: null })
      .where(eq(vocabUserProgress.userId, userId));
    cleaned++;
  };

  for (const row of rows) {
    if (!row.pushSubscription) continue;
    const ok = await sendPushToUser(row.pushSubscription, title, body, url, row.userId);
    if (ok) sent++;
    else     failed++;
  }

  _cleanupCallback = null;

  return { sent, failed, cleaned };
}

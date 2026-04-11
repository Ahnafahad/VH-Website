/**
 * POST /api/vocab/push/subscribe
 *
 * Stores a PushSubscription for the authenticated user and enables
 * notifications. Called by usePushNotifications.subscribe() on the client
 * after the browser grants push permission.
 *
 * Body: { subscription: PushSubscriptionJSON }
 * Response: { success: true }
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users, vocabUserProgress } from '@/lib/db/schema';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';

// ─── Validation ───────────────────────────────────────────────────────────────

const schema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    // keys may be undefined for some push services
    keys: z.object({
      p256dh: z.string(),
      auth:   z.string(),
    }).optional(),
    expirationTime: z.number().nullable().optional(),
  }),
});

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();

    const body   = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new ApiException(
        'Invalid subscription payload: ' + (parsed.error.issues[0]?.message ?? 'unknown'),
        400,
      );
    }

    // Resolve user id
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!user) throw new ApiException('User not found', 404);

    const subscriptionJson = JSON.stringify(parsed.data.subscription);

    await db
      .update(vocabUserProgress)
      .set({
        pushSubscription:     subscriptionJson,
        notificationsEnabled: true,
        updatedAt:            new Date(),
      })
      .where(eq(vocabUserProgress.userId, user.id));

    return { success: true };
  });
}

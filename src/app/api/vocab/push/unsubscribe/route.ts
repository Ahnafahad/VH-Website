/**
 * POST /api/vocab/push/unsubscribe
 *
 * Clears the stored PushSubscription for the authenticated user and
 * disables notifications. Called by usePushNotifications.unsubscribe().
 *
 * Body: (empty)
 * Response: { success: true }
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, vocabUserProgress } from '@/lib/db/schema';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';

export async function POST() {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!user) throw new ApiException('User not found', 404);

    await db
      .update(vocabUserProgress)
      .set({
        pushSubscription:     null,
        notificationsEnabled: false,
        updatedAt:            new Date(),
      })
      .where(eq(vocabUserProgress.userId, user.id));

    return { success: true };
  });
}

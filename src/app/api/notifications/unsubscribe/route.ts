/**
 * POST /api/notifications/unsubscribe
 *
 * Clears the stored site-wide PushSubscription for the authenticated user.
 * Called by usePushNotifications.unsubscribe() (site-wide variant).
 *
 * Body: (empty)
 * Response: { success: true }
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
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
      .update(users)
      .set({
        pushSubscription: null,
        updatedAt:        new Date(),
      })
      .where(eq(users.id, user.id));

    return { success: true };
  }, '/api/notifications/unsubscribe');
}

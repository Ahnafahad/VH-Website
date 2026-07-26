/**
 * GET   /api/notifications/preferences — read the current user's site-wide
 *        notification prefs + whether a subscription is stored.
 * PATCH /api/notifications/preferences — update any subset of the pref flags.
 *
 * GET response:   { notifyMaterials, notifyAnnouncements, notifyCommentReply, subscribed }
 * PATCH body:     { notifyMaterials?, notifyAnnouncements?, notifyCommentReply? }
 * PATCH response: { notifyMaterials, notifyAnnouncements, notifyCommentReply }
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';

// ─── Validation ───────────────────────────────────────────────────────────────

const patchSchema = z.object({
  notifyMaterials:     z.boolean().optional(),
  notifyAnnouncements: z.boolean().optional(),
  notifyCommentReply:  z.boolean().optional(),
});

// ─── GET ────────────────────────────────────────────────────────────────────────

export async function GET() {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();

    const [user] = await db
      .select({
        notifyMaterials:     users.notifyMaterials,
        notifyAnnouncements: users.notifyAnnouncements,
        notifyCommentReply:  users.notifyCommentReply,
        pushSubscription:    users.pushSubscription,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!user) throw new ApiException('User not found', 404);

    return {
      notifyMaterials:     user.notifyMaterials,
      notifyAnnouncements: user.notifyAnnouncements,
      notifyCommentReply:  user.notifyCommentReply,
      subscribed:          user.pushSubscription !== null,
    };
  }, '/api/notifications/preferences');
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();

    const body   = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiException(
        'Invalid preferences payload: ' + (parsed.error.issues[0]?.message ?? 'unknown'),
        400,
      );
    }

    const updates: Partial<{
      notifyMaterials: boolean;
      notifyAnnouncements: boolean;
      notifyCommentReply: boolean;
    }> = {};
    if (parsed.data.notifyMaterials !== undefined)     updates.notifyMaterials     = parsed.data.notifyMaterials;
    if (parsed.data.notifyAnnouncements !== undefined) updates.notifyAnnouncements = parsed.data.notifyAnnouncements;
    if (parsed.data.notifyCommentReply !== undefined)  updates.notifyCommentReply  = parsed.data.notifyCommentReply;

    const [updated] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.email, email))
      .returning({
        notifyMaterials:     users.notifyMaterials,
        notifyAnnouncements: users.notifyAnnouncements,
        notifyCommentReply:  users.notifyCommentReply,
      });
    if (!updated) throw new ApiException('User not found', 404);

    return updated;
  }, '/api/notifications/preferences');
}

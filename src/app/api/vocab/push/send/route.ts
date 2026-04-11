/**
 * POST /api/vocab/push/send
 *
 * Admin-only endpoint for sending push notifications.
 * If userId is provided, sends to that user only.
 * If userId is omitted, broadcasts to ALL subscribed users.
 *
 * Body: { userId?: number, title: string, body: string, url?: string }
 * Response: { sent: number, failed: number }
 */

import { NextRequest } from 'next/server';
import { eq, isNotNull } from 'drizzle-orm';
import { z } from 'zod';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { vocabUserProgress } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { sendPushToUser } from '@/lib/vocab/push-notify';

// ─── Validation ───────────────────────────────────────────────────────────────

const schema = z.object({
  userId: z.number().int().positive().optional(),
  title:  z.string().min(1).max(100),
  body:   z.string().min(1).max(300),
  url:    z.string().optional(),
});

// ─── Admin guard ──────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    throw new ApiException('Admin access required', 403);
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    await requireAdmin();

    const body   = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new ApiException(
        'Invalid body: ' + (parsed.error.issues[0]?.message ?? 'unknown'),
        400,
      );
    }

    const { userId, title, body: msgBody, url = '/vocab' } = parsed.data;

    let sent   = 0;
    let failed = 0;

    if (userId !== undefined) {
      // Single-user send
      const [row] = await db
        .select({ pushSubscription: vocabUserProgress.pushSubscription })
        .from(vocabUserProgress)
        .where(eq(vocabUserProgress.userId, userId))
        .limit(1);

      if (!row?.pushSubscription) {
        throw new ApiException('User has no push subscription', 404);
      }

      const ok = await sendPushToUser(row.pushSubscription, title, msgBody, url);
      if (ok) sent++;
      else     failed++;
    } else {
      // Broadcast to all subscribed users
      const rows = await db
        .select({ pushSubscription: vocabUserProgress.pushSubscription })
        .from(vocabUserProgress)
        .where(isNotNull(vocabUserProgress.pushSubscription));

      for (const row of rows) {
        if (!row.pushSubscription) continue;
        const ok = await sendPushToUser(row.pushSubscription, title, msgBody, url);
        if (ok) sent++;
        else     failed++;
      }
    }

    return { sent, failed };
  });
}

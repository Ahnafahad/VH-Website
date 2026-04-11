/**
 * POST /api/vocab/access-request
 *
 * Submits a full-access request from a phase-2 user.
 * Inserts into vocab_access_requests with status 'pending'.
 *
 * Body: { whatsapp: string, message?: string }
 * Returns: { success: true }
 *
 * Auth: must be authenticated (validateAuth). Any user can request access.
 * Idempotent: if a pending request already exists for this user, returns 409.
 */

import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users, vocabAccessRequests } from '@/lib/db/schema';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';

// ─── Zod schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  whatsapp: z.string().min(5).max(30).trim(),
  message:  z.string().max(500).trim().optional(),
});

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();

    const body   = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new ApiException(
        'Invalid request: ' + (parsed.error.issues[0]?.message ?? 'unknown'),
        400,
      );
    }

    const { whatsapp, message } = parsed.data;

    // Resolve user row
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!user) throw new ApiException('User not found', 404);

    // Check for existing pending request — prevent duplicates
    const [existing] = await db
      .select({ id: vocabAccessRequests.id })
      .from(vocabAccessRequests)
      .where(
        and(
          eq(vocabAccessRequests.userId, user.id),
          eq(vocabAccessRequests.status, 'pending'),
        )
      )
      .limit(1);

    if (existing) {
      // Return success silently — idempotent. User sees the same confirmation state.
      return { success: true, alreadyPending: true };
    }

    // Insert new access request
    await db.insert(vocabAccessRequests).values({
      userId:   user.id,
      whatsapp,
      message:  message ?? null,
      status:   'pending',
    });

    return { success: true };
  });
}

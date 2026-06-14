/**
 * PATCH /api/math/settings
 *
 * Body: { soundEnabled?: boolean, hapticsEnabled?: boolean }
 * Returns: { ok: true, settings: { soundEnabled, hapticsEnabled } }
 *
 * Creates the progress row if it doesn't yet exist.
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, users, mathUserProgress } from '@/lib/db';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';

interface SettingsBody {
  soundEnabled?:   boolean;
  hapticsEnabled?: boolean;
}

export async function PATCH(request: NextRequest): Promise<Response> {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();
    const body = (await request.json()) as SettingsBody;

    if (body.soundEnabled === undefined && body.hapticsEnabled === undefined) {
      throw new ApiException('At least one setting required', 400);
    }

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    if (!user) throw new ApiException('User not found', 404);

    const [existing] = await db
      .select()
      .from(mathUserProgress)
      .where(eq(mathUserProgress.userId, user.id))
      .limit(1);

    if (existing) {
      await db.update(mathUserProgress)
        .set({
          ...(body.soundEnabled   !== undefined ? { soundEnabled:   body.soundEnabled   } : {}),
          ...(body.hapticsEnabled !== undefined ? { hapticsEnabled: body.hapticsEnabled } : {}),
          updatedAt: new Date(),
        })
        .where(eq(mathUserProgress.userId, user.id));

      return {
        ok: true,
        settings: {
          soundEnabled:   body.soundEnabled   ?? existing.soundEnabled,
          hapticsEnabled: body.hapticsEnabled ?? existing.hapticsEnabled,
        },
      };
    }

    const soundEnabled   = body.soundEnabled   ?? true;
    const hapticsEnabled = body.hapticsEnabled ?? true;

    await db.insert(mathUserProgress).values({
      userId: user.id,
      soundEnabled,
      hapticsEnabled,
    });

    return {
      ok: true,
      settings: { soundEnabled, hapticsEnabled },
    };
  });
}

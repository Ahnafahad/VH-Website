/**
 * GET  /api/vocab/admin/settings  — returns all admin settings as key→value map
 * PATCH /api/vocab/admin/settings  — upserts a single setting { key, value }
 *
 * Admin only (session.user.isAdmin must be true).
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { vocabAdminSettings } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';

// Default values when a key has no row yet.
const DEFAULTS: Record<string, string> = {
  ultimate_achievements_visible: 'false',
  quiz_pass_threshold:           '0.70',
  phase_cutoff_date:             '',
};

async function requireAdmin(): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    throw new ApiException('Admin access required', 403);
  }
}

export async function GET() {
  return safeApiHandler(async () => {
    await requireAdmin();

    const rows = await db.select().from(vocabAdminSettings);
    const map: Record<string, string> = { ...DEFAULTS };
    for (const row of rows) {
      map[row.key] = row.value;
    }
    return map;
  });
}

const patchSchema = z.object({
  key:   z.string().min(1),
  value: z.string(),
});

export async function PATCH(req: NextRequest) {
  return safeApiHandler(async () => {
    await requireAdmin();

    const body  = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) throw new ApiException('Invalid body', 400);

    const { key, value } = parsed.data;
    const now = new Date();

    await db
      .insert(vocabAdminSettings)
      .values({ key, value, updatedAt: now })
      .onConflictDoUpdate({
        target: vocabAdminSettings.key,
        set:    { value, updatedAt: now },
      });

    return { ok: true, key, value };
  });
}

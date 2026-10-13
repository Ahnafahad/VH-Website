import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiException, createErrorResponse } from '@/lib/api-utils';
import { requireSuperAdmin } from '@/lib/super/guard';
import { recordAudit } from '@/lib/audit-log';
import { BANNER_LEVELS, clearBanner, getActiveBanner, setBanner } from '@/lib/super/comms/banner';

const putBody = z.object({
  text: z.string().trim().min(1).max(280),
  level: z.enum(BANNER_LEVELS),
  hours: z.number().int().min(1).max(24 * 30),
});

export async function GET() {
  try {
    await requireSuperAdmin();
    return NextResponse.json({ banner: await getActiveBanner() });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const actor = await requireSuperAdmin();
    const parsed = putBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiException('Invalid banner', 400);
    const { text, level, hours } = parsed.data;
    const banner = { text, level, expiresAt: Date.now() + hours * 3600_000 };
    const before = await getActiveBanner();
    await setBanner(banner);
    await recordAudit({ actorUserId: actor.id, action: 'banner.set', entityType: 'banner', before, after: banner });
    return NextResponse.json({ banner });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function DELETE() {
  try {
    const actor = await requireSuperAdmin();
    const before = await getActiveBanner();
    await clearBanner();
    await recordAudit({ actorUserId: actor.id, action: 'banner.clear', entityType: 'banner', before });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return createErrorResponse(error);
  }
}

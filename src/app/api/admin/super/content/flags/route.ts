import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, users, redlineConfig } from '@/lib/db';
import { eq, inArray } from 'drizzle-orm';
import { createErrorResponse, ApiException } from '@/lib/api-utils';
import { requireSuperAdmin } from '@/lib/super/guard';
import { FLAG_DEFS, listFlags, setFlag } from '@/lib/super/flags';
import { getConfig, setActive } from '@/lib/redline/service';
import { recordAudit } from '@/lib/audit-log';

export async function GET() {
  try {
    await requireSuperAdmin();
    const stored = await listFlags();
    const redlineRow = await db.select().from(redlineConfig).where(eq(redlineConfig.id, 1)).get();
    const ids = [...new Set(stored.map(s => s.by).filter((x): x is number => x != null))];
    const names = ids.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ids)) : [];
    const nameOf = (id: number | null) => names.find(n => n.id === id)?.name ?? null;

    const flags: { key: string; label: string; hint: string; value: boolean; by: string | null; at: number | null }[] = FLAG_DEFS.map(d => {
      const s = stored.find(x => x.key === d.key);
      return { key: d.key, label: d.label, hint: d.hint, value: s ? s.value === true : d.default, by: s ? nameOf(s.by) : null, at: s?.at ?? null };
    });
    flags.push({
      key: 'redline', label: 'Redline active', hint: 'Existing Redline module switch (redline_config). Staff can always preview.',
      value: (await getConfig()).active, by: null, at: redlineRow?.updatedAt.getTime() ?? null,
    });
    return NextResponse.json({ flags });
  } catch (error) {
    return createErrorResponse(error);
  }
}

const body = z.object({ key: z.string(), value: z.boolean() });

export async function PUT(req: NextRequest) {
  try {
    const actor = await requireSuperAdmin();
    const parsed = body.safeParse(await req.json());
    if (!parsed.success) throw new ApiException('Invalid body', 400);
    const { key, value } = parsed.data;

    if (key === 'redline') {
      const before = (await getConfig()).active;
      await setActive(value);
      await recordAudit({ actorUserId: actor.id, action: 'flag.set', entityType: 'flag', before: { key, value: before }, after: { key, value } });
    } else if (FLAG_DEFS.some(d => d.key === key)) {
      await setFlag(key, value, actor.id);
    } else {
      throw new ApiException('Unknown switch', 400);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return createErrorResponse(error);
  }
}

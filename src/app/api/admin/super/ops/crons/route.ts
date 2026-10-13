import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createErrorResponse, ApiException } from '@/lib/api-utils';
import { requireSuperAdmin } from '@/lib/super/guard';
import { recordAudit } from '@/lib/audit-log';
import { setLmsSetting } from '@/lib/lms/settings';
import { cronPausedKey } from '@/lib/super/ops/cron-log';
import { knownCron, listCrons } from '@/lib/super/ops/crons';

export async function GET() {
  try {
    await requireSuperAdmin();
    return NextResponse.json({ crons: await listCrons() });
  } catch (error) {
    return createErrorResponse(error);
  }
}

const schema = z.object({ name: z.string().min(1).max(60), action: z.enum(['pause', 'resume', 'run']) });

export async function POST(req: NextRequest) {
  try {
    const actor = await requireSuperAdmin();
    const { name, action } = schema.parse(await req.json());
    const cron = knownCron(name);
    if (!cron) throw new ApiException('Unknown cron', 404);

    if (action === 'run') {
      // The secret stays server-side: this route calls the cron route itself.
      if (!process.env.CRON_SECRET) throw new ApiException('CRON_SECRET is not set', 500);
      await recordAudit({ actorUserId: actor.id, action: 'cron.run', entityType: 'cron', after: { name } });
      const res = await fetch(`${process.env.NEXTAUTH_URL ?? req.nextUrl.origin}${cron.path}`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` }, cache: 'no-store' });
      const body = await res.json().catch(() => null);
      return NextResponse.json({ status: res.status, body });
    }

    await setLmsSetting(cronPausedKey(name), action === 'pause' ? 'true' : 'false');
    await recordAudit({ actorUserId: actor.id, action: `cron.${action}`, entityType: 'cron', after: { name } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return createErrorResponse(error);
  }
}

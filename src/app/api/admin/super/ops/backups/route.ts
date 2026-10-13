import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/api-utils';
import { requireSuperAdmin } from '@/lib/super/guard';
import { recordAudit } from '@/lib/audit-log';
import { getLmsSetting, setLmsSetting } from '@/lib/lms/settings';

const KEY = 'super:ops:last-snapshot';

export async function GET() {
  try {
    await requireSuperAdmin();
    const raw = await getLmsSetting(KEY);
    return NextResponse.json({
      lastSnapshot: raw ? JSON.parse(raw) : null,
      platformConfigured: !!(process.env.TURSO_PLATFORM_TOKEN && process.env.TURSO_ORG && process.env.TURSO_DB_NAME),
      dbName: process.env.TURSO_DB_NAME ?? null,
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}

const schema = z.object({ note: z.string().trim().min(1).max(500) });

export async function POST(req: NextRequest) {
  try {
    const actor = await requireSuperAdmin();
    const { note } = schema.parse(await req.json());
    const value = { note, at: new Date().toISOString(), by: actor.email };
    await setLmsSetting(KEY, JSON.stringify(value));
    await recordAudit({ actorUserId: actor.id, action: 'ops.snapshot.note', entityType: 'ops', after: value });
    return NextResponse.json({ lastSnapshot: value });
  } catch (error) {
    return createErrorResponse(error);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, like } from 'drizzle-orm';
import { db, lmsSettings, users } from '@/lib/db';
import { createErrorResponse, ApiException } from '@/lib/api-utils';
import { requireSuperAdmin } from '@/lib/super/guard';
import { recordAudit } from '@/lib/audit-log';
import { PERM_KEY, permKeyFor, instructorSections, parseHidden } from '@/lib/super/security/permissions';

// GET -> { sections, global: string[], instructors: [{id,name,email,override: string[]|null}] }
export async function GET() {
  try {
    await requireSuperAdmin();
    const [rows, instructors] = await Promise.all([
      db.select().from(lmsSettings).where(like(lmsSettings.key, `${PERM_KEY}%`)),
      db.select({ id: users.id, name: users.name, email: users.email }).from(users)
        .where(and(eq(users.role, 'instructor'), eq(users.status, 'active'))),
    ]);
    const byKey = new Map(rows.map(r => [r.key, r.value]));
    return NextResponse.json({
      sections: instructorSections(),
      global: parseHidden(byKey.get(PERM_KEY)) ?? [],
      instructors: instructors.map(i => ({ ...i, override: parseHidden(byKey.get(permKeyFor(i.id))) })),
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}

// PUT { userId?: number, hidden: string[] | null }  (no userId = global default; hidden:null with userId removes the override)
export async function PUT(req: NextRequest) {
  try {
    const actor = await requireSuperAdmin();
    const body = await req.json().catch(() => ({})) as { userId?: unknown; hidden?: unknown };
    const valid = new Set(instructorSections().map(s => s.href));

    let userId: number | null = null;
    if (body.userId !== undefined && body.userId !== null) {
      userId = Number(body.userId);
      if (!Number.isInteger(userId) || userId <= 0) throw new ApiException('Invalid userId', 400);
      const u = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).get();
      if (u?.role !== 'instructor') throw new ApiException('User is not an instructor', 400);
    }
    const key = userId === null ? PERM_KEY : permKeyFor(userId);
    const before = parseHidden((await db.select().from(lmsSettings).where(eq(lmsSettings.key, key)).get())?.value);

    if (body.hidden === null && userId !== null) {
      await db.delete(lmsSettings).where(eq(lmsSettings.key, key));
    } else {
      if (!Array.isArray(body.hidden) || body.hidden.some(h => typeof h !== 'string' || !valid.has(h))) {
        throw new ApiException('hidden must be a list of known sections', 400);
      }
      const value = JSON.stringify([...new Set(body.hidden as string[])]);
      await db.insert(lmsSettings).values({ key, value })
        .onConflictDoUpdate({ target: lmsSettings.key, set: { value, updatedAt: new Date() } });
    }

    recordAudit({
      actorUserId: actor.id, action: 'permissions.instructor', entityType: 'user', entityId: userId,
      before: { hidden: before }, after: { hidden: body.hidden },
    }).catch(() => {});
    return NextResponse.json({ success: true });
  } catch (error) {
    return createErrorResponse(error);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getUserByEmail } from '@/lib/db-access-control';
import { db, analyticsSessions, analyticsEvents } from '@/lib/db';
import { sql } from 'drizzle-orm';

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const EventSchema = z.object({
  sessionId:  z.string(),
  anonId:     z.string(),
  userId:     z.number().int().nullable().optional(),
  type:       z.enum(['pageview', 'page_exit', 'feature', 'click', 'custom']),
  module:     z.enum(['site', 'vocab', 'math', 'accounting', 'workbook', 'auth', 'admin']).optional(),
  path:       z.string().optional(),
  name:       z.string().optional(),
  props:      z.record(z.string(), z.unknown()).optional(),
  durationMs: z.number().int().min(0).optional(),
  ts:         z.number().optional(),
});

const SessionSchema = z.object({
  id:              z.string(),
  anonId:          z.string(),
  userId:          z.number().int().nullable().optional(),
  isAuthenticated: z.boolean().optional().default(false),
  entryPath:       z.string().optional(),
  referrer:        z.string().optional(),
  device:          z.enum(['mobile', 'tablet', 'desktop']).optional(),
  utmSource:       z.string().optional(),
  utmMedium:       z.string().optional(),
  utmCampaign:     z.string().optional(),
  userAgent:       z.string().optional(),
});

const BodySchema = z.object({
  session: SessionSchema,
  events:  z.array(EventSchema),
});

// ─── POST /api/analytics/ingest ──────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Parse and validate body
  let body: z.infer<typeof BodySchema>;
  try {
    const raw = await req.json();
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    // Cap events at 50
    const events = body.events.slice(0, 50);
    const sessionData = body.session;

    // ── Server-side auth resolution ──────────────────────────────────────────
    let resolvedUserId: number | null = null;
    let resolvedIsAuth = sessionData.isAuthenticated ?? false;

    const serverSession = await getServerSession(authOptions);
    if (serverSession?.user?.email) {
      const user = await getUserByEmail(serverSession.user.email);
      if (user) {
        resolvedUserId = user.id;
        resolvedIsAuth = true;
      }
    }

    // ── Compute aggregates from batch ────────────────────────────────────────
    const pageviewCount = events.filter(e => e.type === 'pageview').length;
    const totalDurationMs = events
      .filter(e => e.type === 'page_exit' && e.durationMs != null)
      .reduce((sum, e) => sum + (e.durationMs ?? 0), 0);

    // Last path across all events (for exitPath)
    const lastEventPath = [...events].reverse().find(e => e.path)?.path ?? undefined;

    // ── Upsert session ───────────────────────────────────────────────────────
    const now = new Date();

    await db
      .insert(analyticsSessions)
      .values({
        id:              sessionData.id,
        anonId:          sessionData.anonId,
        userId:          resolvedUserId,
        isAuthenticated: resolvedIsAuth,
        entryPath:       sessionData.entryPath,
        exitPath:        lastEventPath,
        referrer:        sessionData.referrer,
        utmSource:       sessionData.utmSource,
        utmMedium:       sessionData.utmMedium,
        utmCampaign:     sessionData.utmCampaign,
        device:          sessionData.device,
        userAgent:       sessionData.userAgent,
        pageCount:       pageviewCount,
        eventCount:      events.length,
        durationMs:      totalDurationMs,
        startedAt:       now,
        lastSeenAt:      now,
      })
      .onConflictDoUpdate({
        target: analyticsSessions.id,
        set: {
          lastSeenAt:      now,
          exitPath:        lastEventPath ?? sql`analytics_sessions.exit_path`,
          isAuthenticated: resolvedIsAuth,
          userId:          resolvedUserId ?? sql`analytics_sessions.user_id`,
          pageCount:       sql`analytics_sessions.page_count + ${pageviewCount}`,
          eventCount:      sql`analytics_sessions.event_count + ${events.length}`,
          durationMs:      sql`analytics_sessions.duration_ms + ${totalDurationMs}`,
        },
      });

    // ── Insert events ────────────────────────────────────────────────────────
    if (events.length > 0) {
      const rows = events.map(e => ({
        sessionId:  e.sessionId,
        anonId:     e.anonId,
        userId:     resolvedUserId,
        type:       e.type,
        module:     e.module,
        path:       e.path,
        name:       e.name,
        props:      e.props ? JSON.stringify(e.props) : undefined,
        durationMs: e.durationMs,
        createdAt:  e.ts ? new Date(e.ts) : now,
      }));

      await db.insert(analyticsEvents).values(rows);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // NEVER throw to client — log and return ok:true to keep it resilient
    console.error('[analytics/ingest]', err);
    return NextResponse.json({ ok: true });
  }
}

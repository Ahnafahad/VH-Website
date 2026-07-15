/**
 * GET  /api/admin/errors — fetch merged LexiCore error log (vocab_error_logs +
 *                          client_error/unhandled_rejection analytics events).
 * DELETE /api/admin/errors — clear all rows from vocab_error_logs.
 *
 * Admin / super_admin / instructor only (mirrors analytics route auth exactly).
 * No unstable_cache — always fresh.
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, gte, inArray, lt, or, sql } from 'drizzle-orm';
import { validateAuth, ApiException, createErrorResponse } from '@/lib/api-utils';
import { getUserByEmail } from '@/lib/db-access-control';
import { db } from '@/lib/db';
import { vocabErrorLogs, analyticsEvents } from '@/lib/db/schema';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ErrorLogRow {
  id:        string;   // 'el-<id>' or 'ae-<id>'
  createdAt: string;   // ISO timestamp string
  source:    'quiz_generation' | 'api' | 'client';
  severity:  'error' | 'warning';
  context:   string;
  message:   string;
  detail:    string | null;
  userEmail: string | null;
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireAdminAccess(): Promise<void> {
  const auth = await validateAuth();
  const user = await getUserByEmail(auth.email);
  if (!user || !['admin', 'super_admin', 'instructor'].includes(user.role)) {
    throw new ApiException('Unauthorized', 403);
  }
}

// ─── Prune helper (fire-and-forget) ───────────────────────────────────────────

function pruneOldLogs(): void {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  void db.delete(vocabErrorLogs).where(lt(vocabErrorLogs.createdAt, cutoff)).catch(err => {
    console.error('[admin/errors] Failed to prune old logs:', err);
  });
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    await requireAdminAccess();

    const { searchParams } = new URL(req.url);
    const sourceParam = searchParams.get('source') ?? 'all';
    const limitParam  = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500);
    const before      = searchParams.get('before'); // ISO timestamp cursor

    const limit  = isNaN(limitParam) || limitParam < 1 ? 100 : limitParam;
    const source = ['quiz_generation', 'api', 'client', 'all'].includes(sourceParam)
      ? sourceParam : 'all';

    // Fire-and-forget prune on every admin fetch
    pruneOldLogs();

    // ── 7-day counts per source (for filter chips) ────────────────────────────
    const sevenDaysAgo     = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgoUnix = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

    const [dbCounts] = await Promise.all([
      db
        .select({
          source: vocabErrorLogs.source,
          count:  sql<number>`count(*)`,
        })
        .from(vocabErrorLogs)
        .where(gte(vocabErrorLogs.createdAt, sevenDaysAgo))
        .groupBy(vocabErrorLogs.source),
    ]);

    // Client errors from analytics_events (last 7 days)
    const [clientCountRows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.module, 'vocab'),
            inArray(analyticsEvents.name, ['client_error', 'unhandled_rejection']),
            gte(analyticsEvents.createdAt, sevenDaysAgoUnix as unknown as Date),
          )
        ),
    ]);

    const counts = {
      quiz_generation: 0,
      api:             0,
      client:          (clientCountRows[0]?.count ?? 0) as number,
    };
    for (const row of dbCounts) {
      const s = row.source as keyof typeof counts;
      if (s in counts) counts[s] = row.count as number;
    }

    // ── Fetch rows ────────────────────────────────────────────────────────────
    const rows: ErrorLogRow[] = [];

    const fetchDbLogs = source === 'all' || source !== 'client';
    const fetchClientLogs = source === 'all' || source === 'client';

    if (fetchDbLogs) {
      const sourceFilter = source !== 'all' && source !== 'client'
        ? eq(vocabErrorLogs.source, source)
        : or(
            eq(vocabErrorLogs.source, 'quiz_generation'),
            eq(vocabErrorLogs.source, 'api'),
          );

      const conditions = before
        ? and(sourceFilter, lt(vocabErrorLogs.createdAt, before))
        : sourceFilter;

      const dbRows = await db
        .select()
        .from(vocabErrorLogs)
        .where(conditions)
        .orderBy(desc(vocabErrorLogs.createdAt))
        .limit(limit);

      for (const r of dbRows) {
        rows.push({
          id:        `el-${r.id}`,
          createdAt: r.createdAt,
          source:    r.source as ErrorLogRow['source'],
          severity:  (r.severity ?? 'error') as ErrorLogRow['severity'],
          context:   r.context,
          message:   r.message,
          detail:    r.detail ?? null,
          userEmail: r.userEmail ?? null,
        });
      }
    }

    if (fetchClientLogs) {
      // Convert before-cursor (ISO string) to unix timestamp for analytics_events
      const beforeUnix = before
        ? Math.floor(new Date(before).getTime() / 1000)
        : null;

      const clientConditions = and(
        eq(analyticsEvents.module, 'vocab'),
        inArray(analyticsEvents.name, ['client_error', 'unhandled_rejection']),
        beforeUnix
          ? lt(analyticsEvents.createdAt, beforeUnix as unknown as Date)
          : undefined,
      );

      const clientRows = await db
        .select()
        .from(analyticsEvents)
        .where(clientConditions)
        .orderBy(desc(analyticsEvents.createdAt))
        .limit(limit);

      for (const r of clientRows) {
        // createdAt is stored as unix timestamp integer — convert to ISO string
        const createdAtMs =
          typeof r.createdAt === 'number'
            ? r.createdAt * 1000
            : (r.createdAt as unknown as Date).getTime?.() ?? Date.now();
        const createdAtIso = new Date(createdAtMs).toISOString();

        // Extract error message + detail from props JSON
        let message = r.name ?? 'client error';
        let detail: string | null = null;
        if (r.props) {
          try {
            const props = JSON.parse(r.props) as Record<string, unknown>;
            if (typeof props.message === 'string') message = props.message;
            detail = r.props;
          } catch {
            detail = r.props;
          }
        }

        rows.push({
          id:        `ae-${r.id}`,
          createdAt: createdAtIso,
          source:    'client',
          severity:  'error',
          context:   r.path ?? r.name ?? 'client',
          message,
          detail,
          userEmail: null, // analytics events don't carry email
        });
      }
    }

    // Merge and sort newest-first
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const page = rows.slice(0, limit);

    // Cursor for next page: createdAt of the last item
    const nextBefore = page.length === limit ? page[page.length - 1]?.createdAt : null;

    return NextResponse.json({ rows: page, counts, nextBefore });
  } catch (error) {
    return createErrorResponse(error);
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE() {
  try {
    await requireAdminAccess();
    await db.delete(vocabErrorLogs);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return createErrorResponse(error);
  }
}

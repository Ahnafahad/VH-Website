import { db, users } from '@/lib/db';
import { sql }        from 'drizzle-orm';

export async function GET() {
  const results: Record<string, number | string> = {};

  // 1. Raw Turso RTT — minimal query
  const t0 = performance.now();
  await db.run(sql`SELECT 1`);
  results.turso_rtt_1_ms = +(performance.now() - t0).toFixed(1);

  // 2. Second RTT (warm connection — compare with first)
  const t1 = performance.now();
  await db.run(sql`SELECT 1`);
  results.turso_rtt_2_ms = +(performance.now() - t1).toFixed(1);

  // 3. Two sequential real queries
  const tSeqStart = performance.now();
  await db.select({ id: users.id }).from(users).limit(1);
  const tSeqMid = performance.now();
  await db.select({ id: users.id }).from(users).limit(1);
  const tSeqEnd = performance.now();
  results.sequential_query1_ms = +(tSeqMid - tSeqStart).toFixed(1);
  results.sequential_query2_ms = +(tSeqEnd - tSeqMid).toFixed(1);
  results.sequential_total_ms  = +(tSeqEnd - tSeqStart).toFixed(1);

  // 4. Same two queries in parallel
  const tParStart = performance.now();
  await Promise.all([
    db.select({ id: users.id }).from(users).limit(1),
    db.select({ id: users.id }).from(users).limit(1),
  ]);
  results.parallel_total_ms = +(performance.now() - tParStart).toFixed(1);

  // 5. Environment info
  results.vercel_region    = process.env.VERCEL_REGION    ?? 'local (not vercel)';
  results.turso_url_scheme = (process.env.TURSO_DATABASE_URL ?? '').split('://')[0] || 'unknown';

  return Response.json(results, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

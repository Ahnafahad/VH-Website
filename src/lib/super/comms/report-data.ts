import { and, eq, gte, like, sql } from 'drizzle-orm';
import { Resend } from 'resend';
import { db } from '@/lib/db';
import { broadcasts, lmsSettings, registrations, users, vocabErrorLogs } from '@/lib/db/schema';
import { ROOT_EMAIL } from '@/lib/super/guard';
import { buildWeeklyReport, type ReportData } from './report';

const DAY = 86_400_000;

/** super:ops:cron:* values are written by the Ops agent; treat anything that says failed/error/ok:false as failed. */
function isFailedCron(raw: string): boolean {
  try {
    const v = JSON.parse(raw) as { ok?: boolean; status?: string; error?: unknown };
    return v.ok === false || v.status === 'failed' || v.status === 'error' || Boolean(v.error);
  } catch { return false; }
}

export async function gatherReportData(now = new Date()): Promise<ReportData> {
  const since = new Date(now.getTime() - 7 * DAY);
  const sinceIso = since.toISOString().slice(0, 19) + 'Z';
  const idleSec = Math.floor((now.getTime() - 14 * DAY) / 1000);
  const n = (r: { n: number } | undefined) => Number(r?.n ?? 0);

  const [newStudents, regs, errors, atRisk, cronRows, bc] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(users).where(and(eq(users.role, 'student'), gte(users.createdAt, since))).get(),
    db.select({ n: sql<number>`count(*)` }).from(registrations).where(gte(registrations.createdAt, since)).get(),
    db.select({ n: sql<number>`count(*)` }).from(vocabErrorLogs).where(and(eq(vocabErrorLogs.severity, 'error'), gte(vocabErrorLogs.createdAt, sinceIso))).get(),
    db.select({ n: sql<number>`count(*)` }).from(users).where(and(
      eq(users.role, 'student'), eq(users.status, 'active'),
      sql`not exists (select 1 from test_attempts ta where ta.user_id = ${users.id} and ta.started_at >= ${idleSec})`,
    )).get(),
    db.select().from(lmsSettings).where(like(lmsSettings.key, 'super:ops:cron:%')),
    db.select({ status: broadcasts.status, n: sql<number>`count(*)` }).from(broadcasts).where(gte(broadcasts.createdAt, since)).groupBy(broadcasts.status),
  ]);

  const cnt = (s: string) => Number(bc.find(r => r.status === s)?.n ?? 0);
  return {
    weekEnding: now.toISOString().slice(0, 10),
    newStudents: n(newStudents), registrations: n(regs), atRiskProxy: n(atRisk), errors7d: n(errors),
    cronsTracked: cronRows.length > 0,
    failedCrons: cronRows.filter(r => isFailedCron(r.value)).map(r => r.key.replace('super:ops:cron:', '')),
    broadcasts: { sent: cnt('sent'), failed: cnt('failed'), scheduled: cnt('scheduled') },
  };
}

/** Sends the report to the root email only. */
export async function sendWeeklyReport(): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) return { ok: false, error: 'RESEND_API_KEY is not set' };
  const { subject, text, html } = buildWeeklyReport(await gatherReportData());
  const res = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: 'VH Reports <noreply@vh-beyondthehorizons.org>', to: ROOT_EMAIL, subject, text, html,
  });
  return res.error ? { ok: false, error: res.error.message } : { ok: true };
}

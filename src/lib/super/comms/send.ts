/**
 * Broadcast delivery. Recipients come from resolveAudience (via segment.ts); push uses sendPushToUser and
 * email uses sendStudentNotice — the same senders the rest of the site uses.
 * Preferences: push needs a subscription AND notifyAnnouncements (as notifyStudentsForContent does);
 * email has no per-user preference column and goes to every resolved recipient (as the announcement blast does).
 */
import { and, desc, eq, like, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { broadcasts, lmsSettings } from '@/lib/db/schema';
import { setLmsSetting } from '@/lib/lms/settings';
import { sendStudentNotice } from '@/lib/email';
import { sendPushToUser } from '@/lib/notifications/push';
import { recordAudit } from '@/lib/audit-log';
import { setBanner } from './banner';
import { channelsSchema, segmentSchema, resolveSegment, type Channel, type Segment } from './segment';

const BASE_URL = (process.env.NEXTAUTH_URL ?? 'https://www.vh-beyondthehorizons.org').replace(/\/$/, '');
const EMAIL_BATCH = 5;          // Resend allows ~2 req/s on the default plan: 5 per ~1.1s is the ceiling we stay under
const EMAIL_BATCH_DELAY_MS = 1100;
const PUSH_BATCH = 10;
const BANNER_DEFAULT_MS = 72 * 3600_000;

export interface DeliveryResult {
  recipients: number;
  push?: { sent: number; failed: number; skippedNoPref: number };
  email?: { sent: number; failed: number };
  banner?: boolean;
  error?: string;
}

export const resultKey = (id: number) => `super:comms:result:${id}`;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export function parseBroadcastRow(row: { channels: string; segment: string }): { channels: Channel[]; segment: Segment } {
  return {
    channels: channelsSchema.parse(JSON.parse(row.channels)),
    segment: segmentSchema.parse(JSON.parse(row.segment)) as Segment,
  };
}

export async function deliver(
  b: { title: string; body: string; channels: Channel[]; segment: Segment },
  opts: { bannerMs?: number } = {},
): Promise<DeliveryResult> {
  const recipients = await resolveSegment(b.segment);
  const result: DeliveryResult = { recipients: recipients.length };

  if (b.channels.includes('push')) {
    const targets = recipients.filter(r => r.pushSubscription && r.notifyAnnouncements);
    let sent = 0, failed = 0;
    for (let i = 0; i < targets.length; i += PUSH_BATCH) {
      const res = await Promise.all(targets.slice(i, i + PUSH_BATCH).map(r =>
        sendPushToUser(r.pushSubscription!, { title: b.title, body: b.body, url: '/' }).catch(() => false)));
      for (const ok of res) { if (ok) sent++; else failed++; }
    }
    result.push = { sent, failed, skippedNoPref: recipients.length - targets.length };
  }

  if (b.channels.includes('email')) {
    let sent = 0, failed = 0;
    for (let i = 0; i < recipients.length; i += EMAIL_BATCH) {
      const res = await Promise.all(recipients.slice(i, i + EMAIL_BATCH).map(r =>
        sendStudentNotice(r.email, b.title, {
          kicker: 'VH Announcement', name: r.name.split(' ')[0] || r.name, heading: b.title,
          message: b.body, ctaLabel: 'Open VH', ctaUrl: BASE_URL,
        }).then(x => x.success > 0).catch(() => false)));
      for (const ok of res) { if (ok) sent++; else failed++; }
      if (i + EMAIL_BATCH < recipients.length) await sleep(EMAIL_BATCH_DELAY_MS);
    }
    result.email = { sent, failed };
  }

  if (b.channels.includes('banner')) {
    await setBanner({ text: `${b.title}: ${b.body}`.slice(0, 280), level: 'info', expiresAt: Date.now() + (opts.bannerMs ?? BANNER_DEFAULT_MS) });
    result.banner = true;
  }
  return result;
}

/** Atomic claim: only one caller can flip scheduled -> sending, so double runs cannot double-send. */
export async function claimAndSend(id: number, actorUserId: number | null): Promise<DeliveryResult | null> {
  const claim = await db.update(broadcasts).set({ status: 'sending' })
    .where(and(eq(broadcasts.id, id), eq(broadcasts.status, 'scheduled')));
  if (((claim as unknown as { rowsAffected?: number }).rowsAffected ?? 0) === 0) return null;

  const row = await db.select().from(broadcasts).where(eq(broadcasts.id, id)).get();
  if (!row) return null;
  let result: DeliveryResult;
  try {
    const { channels, segment } = parseBroadcastRow(row);
    result = await deliver({ title: row.title, body: row.body, channels, segment });
  } catch (e) {
    result = { recipients: 0, error: e instanceof Error ? e.message : String(e) };
  }
  const sentCount = (result.push?.sent ?? 0) + (result.email?.sent ?? 0) + (result.banner ? 1 : 0);
  const attempted = (result.push ? result.push.sent + result.push.failed : 0) + (result.email ? result.email.sent + result.email.failed : 0);
  const failedAll = Boolean(result.error) || (!result.banner && attempted > 0 && sentCount === 0);
  const status = failedAll ? 'failed' : 'sent';
  await db.update(broadcasts).set({ status, sentCount, sentAt: new Date() }).where(eq(broadcasts.id, id));
  await setLmsSetting(resultKey(id), JSON.stringify(result));
  await recordAudit({ actorUserId: actorUserId ?? row.createdBy, action: 'broadcast.deliver', entityType: 'broadcast', entityId: id, after: { status, ...result } });
  return result;
}

/** Cron: send due scheduled broadcasts (a few per run so one invocation stays within maxDuration). */
export async function runDueBroadcasts(max = 1): Promise<{ id: number; status: string }[]> {
  // A run that timed out mid-send leaves its row 'sending' forever; surface it as failed instead of hiding it.
  await db.update(broadcasts).set({ status: 'failed' })
    .where(and(eq(broadcasts.status, 'sending'), lte(broadcasts.scheduledAt, new Date(Date.now() - 30 * 60_000))));
  const due = await db.select({ id: broadcasts.id }).from(broadcasts)
    .where(and(eq(broadcasts.status, 'scheduled'), lte(broadcasts.scheduledAt, new Date())))
    .orderBy(broadcasts.scheduledAt).limit(max);
  const out: { id: number; status: string }[] = [];
  for (const { id } of due) {
    const r = await claimAndSend(id, null);
    out.push({ id, status: r === null ? 'skipped' : r.error ? 'failed' : 'sent' });
  }
  return out;
}

export async function listBroadcasts(limit = 50) {
  const rows = await db.select().from(broadcasts).orderBy(desc(broadcasts.id)).limit(limit);
  const results = await db.select().from(lmsSettings).where(like(lmsSettings.key, 'super:comms:result:%'));
  const byKey = new Map(results.map(r => [r.key, r.value]));
  return rows.map(r => {
    let result: DeliveryResult | null = null;
    try { const raw = byKey.get(resultKey(r.id)); result = raw ? JSON.parse(raw) as DeliveryResult : null; } catch { /* ignore */ }
    return { ...r, scheduledAt: r.scheduledAt?.getTime() ?? null, createdAt: r.createdAt.getTime(), sentAt: r.sentAt?.getTime() ?? null, result };
  });
}

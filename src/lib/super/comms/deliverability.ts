/** Email deliverability: warmup progress (mirrors /api/cron/email-warmup) + recent Resend events. */

// Mirrors the constants in src/app/api/cron/email-warmup/route.ts (route modules cannot export them).
const WARMUP_START_DATE = '2026-06-10';
const WARMUP_DAYS = 14;

export function warmupStatus(now = new Date()) {
  const start = new Date(`${WARMUP_START_DATE}T00:00:00Z`);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = Math.floor((today.getTime() - start.getTime()) / 86_400_000) + 1;
  const endsOn = new Date(start.getTime() + (WARMUP_DAYS - 1) * 86_400_000).toISOString().slice(0, 10);
  return { startDate: WARMUP_START_DATE, totalDays: WARMUP_DAYS, day: Math.max(day, 0), complete: day > WARMUP_DAYS, endsOn };
}

export interface ResendEmail { id: string; to: string[] | string; subject?: string; created_at?: string; last_event?: string }

/** Pure: counts by last_event and the problem rows (bounced / complained / failed). */
export function summarizeEvents(emails: ResendEmail[]) {
  const counts: Record<string, number> = {};
  for (const e of emails) {
    const k = e.last_event ?? 'unknown';
    counts[k] = (counts[k] ?? 0) + 1;
  }
  const problems = emails
    .filter(e => ['bounced', 'complained', 'failed', 'suppressed'].includes(e.last_event ?? ''))
    .map(e => ({ id: e.id, to: Array.isArray(e.to) ? e.to.join(', ') : e.to, subject: e.subject ?? '', event: e.last_event!, at: e.created_at ?? '' }));
  return { total: emails.length, counts, problems };
}

export type ResendEvents =
  | { available: false; reason: string }
  | ({ available: true } & ReturnType<typeof summarizeEvents>);

export async function fetchResendEvents(): Promise<ResendEvents> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { available: false, reason: 'RESEND_API_KEY is not set' };
  try {
    const res = await fetch('https://api.resend.com/emails?limit=100', { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' });
    if (!res.ok) return { available: false, reason: `Resend returned ${res.status} (the key may be send-only)` };
    const json = (await res.json()) as { data?: ResendEmail[] };
    return { available: true, ...summarizeEvents(json.data ?? []) };
  } catch (e) {
    return { available: false, reason: e instanceof Error ? e.message : 'Request failed' };
  }
}

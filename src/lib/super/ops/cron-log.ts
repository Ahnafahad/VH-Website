/**
 * Cron run log + pause switch, stored in lmsSettings.
 *   super:ops:cron:<name>         -> JSON CronRun
 *   super:ops:cron-paused:<name>  -> 'true' when paused
 * withCronLog never changes the wrapped handler's response; logging/pause lookups fail open.
 */
import { getLmsSetting, setLmsSetting } from '@/lib/lms/settings';

export interface CronRun { startedAt: string; endedAt: string; durationMs: number; ok: boolean; error?: string }

export const cronKey = (name: string) => `super:ops:cron:${name}`;
export const cronPausedKey = (name: string) => `super:ops:cron-paused:${name}`;

export async function isCronPaused(name: string): Promise<boolean> {
  return (await getLmsSetting(cronPausedKey(name))) === 'true';
}

export async function getCronRun(name: string): Promise<CronRun | null> {
  try {
    const raw = await getLmsSetting(cronKey(name));
    return raw ? (JSON.parse(raw) as CronRun) : null;
  } catch { return null; }
}

export function withCronLog<A extends unknown[]>(
  name: string,
  handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    const req0 = args[0] as { headers?: Headers } | undefined;
    const secret0 = process.env.CRON_SECRET;
    // Unauthenticated hits (bad/missing secret) must not overwrite the real last-run record.
    const authed = !!secret0 && req0?.headers?.get('authorization') === `Bearer ${secret0}`;
    try {
      // Only reveal "paused" to an authenticated caller; anyone else falls through to the handler's own 401.
      const req = args[0] as { headers?: Headers } | undefined;
      const secret = process.env.CRON_SECRET;
      if (secret && req?.headers?.get('authorization') === `Bearer ${secret}` && (await isCronPaused(name))) {
        return Response.json({ skipped: 'paused' });
      }
    } catch { /* fail open: a settings outage must not stop the cron */ }

    const start = Date.now();
    let res: Response | undefined;
    let error: string | undefined;
    let thrown: unknown;
    try {
      res = await handler(...args);
      if (res.status >= 400) error = `HTTP ${res.status}`;
    } catch (e) {
      thrown = e;
      error = e instanceof Error ? e.message : String(e);
    }
    const end = Date.now();
    const run: CronRun = {
      startedAt: new Date(start).toISOString(), endedAt: new Date(end).toISOString(),
      durationMs: end - start, ok: !error, ...(error ? { error: error.slice(0, 300) } : {}),
    };
    if (authed) { try { await setLmsSetting(cronKey(name), JSON.stringify(run)); } catch { /* ignore */ } }
    if (thrown !== undefined) throw thrown;
    return res!;
  };
}

import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.mock('@/lib/lms/settings', () => ({
  getLmsSetting: async (k: string) => store.get(k) ?? null,
  setLmsSetting: async (k: string, v: string) => { store.set(k, v); },
}));

import { withCronLog, getCronRun, cronPausedKey } from '../cron-log';
import { evaluateThreshold, thresholdsSchema, DEFAULT_THRESHOLDS } from '../thresholds-core';

const authed = () => ({ headers: new Headers({ authorization: 'Bearer s3cret' }) });
beforeEach(() => { store.clear(); process.env.CRON_SECRET = 's3cret'; });

describe('withCronLog', () => {
  it('logs success and passes the response through untouched', async () => {
    const h = withCronLog('t', async (_r?: unknown) => Response.json({ a: 1 }));
    const res = await h(authed());
    expect(await res.json()).toEqual({ a: 1 });
    const run = await getCronRun('t');
    expect(run?.ok).toBe(true);
    expect(run?.error).toBeUndefined();
  });
  it('logs an HTTP error status as failure but still returns the response', async () => {
    const res = await withCronLog('t', async (_r?: unknown) => Response.json({ e: 1 }, { status: 500 }))(authed());
    expect(res.status).toBe(500);
    expect(await getCronRun('t')).toMatchObject({ ok: false, error: 'HTTP 500' });
  });
  it('does not record anything for an unauthenticated call', async () => {
    await withCronLog('t', async (_r?: unknown) => Response.json({}, { status: 401 }))({ headers: new Headers() });
    expect(await getCronRun('t')).toBeNull();
  });
  it('logs a thrown error and rethrows', async () => {
    const h = withCronLog('t', async (_r?: unknown) => { throw new Error('boom'); });
    await expect(h(authed())).rejects.toThrow('boom');
    expect(await getCronRun('t')).toMatchObject({ ok: false, error: 'boom' });
  });
  it('skips the handler when paused, only for an authenticated caller', async () => {
    process.env.CRON_SECRET = 's3cret';
    store.set(cronPausedKey('t'), 'true');
    const fn = vi.fn(async (_req?: { headers: Headers }) => Response.json({}));
    const authed = { headers: new Headers({ authorization: 'Bearer s3cret' }) };
    const res = await withCronLog('t', fn)(authed);
    expect(await res.json()).toEqual({ skipped: 'paused' });
    expect(fn).not.toHaveBeenCalled();
    expect(await getCronRun('t')).toBeNull();
    // unauthenticated callers reach the handler (which does its own 401) and learn nothing
    await withCronLog('t', fn)({ headers: new Headers() });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('thresholds', () => {
  const l = { warn: 10, bad: 20 };
  it('evaluates tone boundaries', () => {
    expect(evaluateThreshold(9, l)).toBe('ok');
    expect(evaluateThreshold(10, l)).toBe('warn');
    expect(evaluateThreshold(20, l)).toBe('bad');
    expect(evaluateThreshold(null, l)).toBeUndefined();
  });
  it('rejects warn > bad and accepts defaults', () => {
    expect(thresholdsSchema.safeParse(DEFAULT_THRESHOLDS).success).toBe(true);
    expect(thresholdsSchema.safeParse({ ...DEFAULT_THRESHOLDS, r2Bytes: { warn: 5, bad: 1 } }).success).toBe(false);
  });
});

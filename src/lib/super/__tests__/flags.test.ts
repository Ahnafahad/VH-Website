import { beforeEach, describe, expect, it, vi } from 'vitest';

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/db', () => ({ get db() { return holder.db; } }));
vi.mock('@/lib/audit-log', () => ({ recordAudit: vi.fn(async () => {}) }));

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@/lib/db/schema';
import { getFlag, setFlag, listFlags, _clearFlagCache } from '../flags';
import { recordAudit } from '@/lib/audit-log';

beforeEach(async () => {
  const client = createClient({ url: ':memory:' });
  await client.execute('CREATE TABLE lms_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL DEFAULT (unixepoch()))');
  holder.db = drizzle(client, { schema });
  _clearFlagCache();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('flags', () => {
  it('returns the default when unset', async () => {
    expect(await getFlag('registration_open', true)).toBe(true);
    expect(await getFlag('maintenance', false)).toBe(false);
  });

  it('setFlag persists, audits and lists with who/when', async () => {
    await setFlag('maintenance', true, 7);
    expect(await getFlag('maintenance', false)).toBe(true);
    expect(recordAudit).toHaveBeenCalledTimes(1);
    const [f] = await listFlags();
    expect(f).toMatchObject({ key: 'maintenance', value: true, by: 7 });
  });

  it('serves from cache for 30s, then re-reads the DB', async () => {
    vi.useFakeTimers();
    await setFlag('maintenance', true, 1);
    // out-of-band DB change is invisible while cached
    await (holder.db as ReturnType<typeof drizzle>).update(schema.lmsSettings)
      .set({ value: JSON.stringify({ value: false, by: 2, at: 0 }) });
    expect(await getFlag('maintenance', false)).toBe(true);
    vi.advanceTimersByTime(31_000);
    expect(await getFlag('maintenance', false)).toBe(false);
  });
});

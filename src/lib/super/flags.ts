/**
 * Feature switches backed by lmsSettings keys `super:flag:<name>`, cached 30s in-memory.
 * Value is stored as JSON {value, by, at} so the panel can show "last changed by/when".
 * Redline's switch is NOT here — it lives in redline_config (see lib/redline/service).
 */
import { eq, like } from 'drizzle-orm';
import { db } from '@/lib/db';
import { lmsSettings } from '@/lib/db/schema';
import { recordAudit } from '@/lib/audit-log';

const PREFIX = 'super:flag:';
const TTL_MS = 30_000;
const cache = new Map<string, { value: unknown; exp: number }>();

export const FLAG_DEFS = [
  { key: 'maintenance', label: 'Maintenance mode', hint: 'Students see a "back soon" page. Staff keep full access.', default: false },
  { key: 'registration_open', label: 'Registration open', hint: 'When off, the registration pages and forms show a closed message.', default: true },
] as const;

interface Stored { value: unknown; by: number | null; at: number }

function parse(raw: string): Stored | null {
  try {
    const s = JSON.parse(raw);
    return s && typeof s === 'object' && 'value' in s ? (s as Stored) : null;
  } catch { return null; }
}

export async function getFlag<T = boolean>(key: string, def: T): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.value as T;
  const row = await db.select().from(lmsSettings).where(eq(lmsSettings.key, PREFIX + key)).get();
  const value = ((row && parse(row.value)?.value) ?? def) as T;
  cache.set(key, { value, exp: Date.now() + TTL_MS });
  return value;
}

export async function setFlag(key: string, value: unknown, actorId: number): Promise<void> {
  const before = await getFlag<unknown>(key, null);
  const json = JSON.stringify({ value, by: actorId, at: Date.now() } satisfies Stored);
  await db.insert(lmsSettings).values({ key: PREFIX + key, value: json })
    .onConflictDoUpdate({ target: lmsSettings.key, set: { value: json, updatedAt: new Date() } });
  cache.set(key, { value, exp: Date.now() + TTL_MS });
  await recordAudit({ actorUserId: actorId, action: 'flag.set', entityType: 'flag', before: { key, value: before }, after: { key, value } });
}

export async function listFlags(): Promise<{ key: string; value: unknown; by: number | null; at: number }[]> {
  const rows = await db.select().from(lmsSettings).where(like(lmsSettings.key, PREFIX + '%'));
  return rows.flatMap(r => {
    const s = parse(r.value);
    return s ? [{ key: r.key.slice(PREFIX.length), value: s.value, by: s.by, at: s.at }] : [];
  });
}

export function _clearFlagCache() { cache.clear(); }

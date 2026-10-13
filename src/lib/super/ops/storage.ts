import { db } from '@/lib/db';
import { getLmsSetting, setLmsSetting } from '@/lib/lms/settings';
import { r2ListPage } from '@/lib/storage/r2';

const TTL_MS = 60_000;
const R2_PAGE_CAP = 20; // 20k objects max per refresh
const TABLE_CAP = 300;
const SNAP_KEY = 'super:ops:r2-snapshots';

let cache: { at: number; data: StorageReport } | null = null;

export interface StorageReport {
  tables: { name: string; rows: number }[]; totalRows: number; tablesCapped: boolean;
  turso: { bytes: number | null; configured: boolean; error?: string };
  r2: { configured: boolean; objects?: number; bytes?: number; capped?: boolean; growthBytesPerDay?: number | null; error?: string };
  resend: { configured: boolean; last100?: Record<string, number>; error?: string };
}

async function tableCounts() {
  const client = db.$client;
  const names = (await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"))
    .rows.map(r => String(r.name));
  const use = names.slice(0, TABLE_CAP);
  const res = await client.batch(use.map(n => `SELECT count(*) AS c FROM "${n.replace(/"/g, '""')}"`), 'read');
  const tables = use.map((name, i) => ({ name, rows: Number(res[i].rows[0].c) })).sort((a, b) => b.rows - a.rows);
  return { tables, capped: names.length > TABLE_CAP };
}

async function tursoBytes(): Promise<StorageReport['turso']> {
  const { TURSO_PLATFORM_TOKEN: token, TURSO_ORG: org, TURSO_DB_NAME: dbName } = process.env;
  if (!token || !org || !dbName) return { bytes: null, configured: false };
  try {
    const res = await fetch(`https://api.turso.tech/v1/organizations/${encodeURIComponent(org)}/databases/${encodeURIComponent(dbName)}/usage`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (!res.ok) throw new Error(`Turso API ${res.status}`);
    const j = await res.json();
    return { bytes: j?.database?.usage?.storage_bytes ?? null, configured: true };
  } catch (e) {
    return { bytes: null, configured: true, error: e instanceof Error ? e.message : 'failed' };
  }
}

async function r2Stats(): Promise<StorageReport['r2']> {
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET) return { configured: false };
  try {
    let objects = 0, bytes = 0, token: string | undefined, pages = 0;
    do {
      const p = await r2ListPage(token);
      objects += p.count; bytes += p.bytes; token = p.next; pages++;
    } while (token && pages < R2_PAGE_CAP);
    const capped = !!token;
    // Growth hint: daily snapshots (only recorded when the listing was not capped).
    let growth: number | null = null;
    try {
      const snaps: { t: number; bytes: number }[] = JSON.parse((await getLmsSetting(SNAP_KEY)) ?? '[]');
      if (!capped && (!snaps.length || Date.now() - snaps[snaps.length - 1].t > 86_400_000)) {
        snaps.push({ t: Date.now(), bytes });
        await setLmsSetting(SNAP_KEY, JSON.stringify(snaps.slice(-30)));
      }
      const first = snaps[0];
      if (first && Date.now() - first.t > 86_400_000) growth = ((bytes - first.bytes) / (Date.now() - first.t)) * 86_400_000;
    } catch { /* hint is optional */ }
    return { configured: true, objects, bytes, capped, growthBytesPerDay: growth };
  } catch (e) {
    return { configured: true, error: e instanceof Error ? e.message : 'failed' };
  }
}

async function resendStats(): Promise<StorageReport['resend']> {
  if (!process.env.RESEND_API_KEY) return { configured: false };
  try {
    const res = await fetch('https://api.resend.com/emails?limit=100', { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }, cache: 'no-store' });
    if (!res.ok) throw new Error(`Resend API ${res.status} (a sending-only key cannot list emails)`);
    const j = await res.json();
    const last100: Record<string, number> = {};
    for (const e of j.data ?? []) { const k = e.last_event ?? 'unknown'; last100[k] = (last100[k] ?? 0) + 1; }
    return { configured: true, last100 };
  } catch (e) {
    return { configured: true, error: e instanceof Error ? e.message : 'failed' };
  }
}

export async function getStorageReport(): Promise<StorageReport> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  const [t, turso, r2, resend] = await Promise.all([tableCounts(), tursoBytes(), r2Stats(), resendStats()]);
  const data: StorageReport = { tables: t.tables, totalRows: t.tables.reduce((n, x) => n + x.rows, 0), tablesCapped: t.capped, turso, r2, resend };
  cache = { at: Date.now(), data };
  return data;
}

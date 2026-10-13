/**
 * Danger-zone actions. Each is proposed via approvals.proposeAction (delayed, cancellable) and executed
 * by the registered executor; importing this module registers them (routes + cron must import it).
 */
import { z } from 'zod';
import { is, getTableName } from 'drizzle-orm';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { registerExecutor } from '@/lib/super/approvals';
import { isRootEmail } from '@/lib/super/guard';
import { isStaffRole } from '@/lib/auth/roles';

export const DANGER_DELAY_MINUTES = 15;

const Payloads = {
  'table.wipe_reading_speed': z.object({}).strict(),
  'batch.archive': z.object({ batch: z.string().trim().min(1).max(60) }).strict(),
  'user.delete_full': z.object({ userId: z.number().int().positive() }).strict(),
  'analytics.purge': z.object({ days: z.number().int().min(7).max(3650) }).strict(),
} as const;
export type DangerAction = keyof typeof Payloads;
export const DANGER_ACTIONS = Object.keys(Payloads) as DangerAction[];

export interface Preview { summary: string; lines: string[]; phrase: string; refusal?: string }

const n = async (sqlText: string, args: (string | number)[] = []) =>
  Number((await db.$client.execute({ sql: sqlText, args })).rows[0]?.[0] ?? 0);

interface FkRef { table: string; column: string; onDelete: string }
/** Every FK pointing at `parent`, derived from schema.ts (Drizzle metadata). */
export function referencesTo(parent: string): FkRef[] {
  const out: FkRef[] = [];
  for (const t of Object.values(schema)) {
    if (!is(t, SQLiteTable)) continue;
    const cfg = getTableConfig(t);
    for (const fk of cfg.foreignKeys) {
      const ref = fk.reference();
      if (getTableName(ref.foreignTable) !== parent) continue;
      out.push({ table: cfg.name, column: ref.columns[0].name, onDelete: (fk.onDelete ?? 'no action').toLowerCase() });
    }
  }
  return out;
}

export async function userImpact(userId: number) {
  const rows: { table: string; column: string; onDelete: string; count: number; children: string[] }[] = [];
  for (const r of referencesTo('users')) {
    const count = await n(`SELECT count(*) FROM "${r.table}" WHERE "${r.column}" = ?`, [userId]);
    if (count) rows.push({ ...r, count, children: r.onDelete === 'cascade' ? referencesTo(r.table).map(c => c.table) : [] });
  }
  return rows;
}

export async function previewDanger(action: DangerAction, rawPayload: unknown): Promise<Preview> {
  const payload = Payloads[action].parse(rawPayload);
  switch (action) {
    case 'table.wipe_reading_speed': {
      const c = await n('SELECT count(*) FROM reading_speed_attempts');
      return { summary: `Wipe ALL reading_speed_attempts (${c} rows)`, lines: [`${c} rows will be permanently deleted.`], phrase: 'WIPE READING SPEED' };
    }
    case 'batch.archive': {
      const { batch } = payload as { batch: string };
      const c = await n(`SELECT count(*) FROM users WHERE batch = ? AND role = 'student' AND status = 'active'`, [batch]);
      return {
        summary: `Archive batch "${batch}": set ${c} active students to inactive`,
        lines: [`${c} active students in batch "${batch}" become inactive (staff are never touched).`],
        phrase: `ARCHIVE ${batch}`,
        refusal: c === 0 ? 'No active students in that batch' : undefined,
      };
    }
    case 'user.delete_full': {
      const { userId } = payload as { userId: number };
      const u = (await db.$client.execute({ sql: 'SELECT id, email, name, role FROM users WHERE id = ?', args: [userId] })).rows[0];
      if (!u) return { summary: 'Delete user', lines: [], phrase: '', refusal: 'User not found' };
      const email = String(u.email);
      const refusal = isRootEmail(email) ? 'The root account can never be deleted'
        : isStaffRole(String(u.role)) ? `${email} is ${u.role}: demote to student first` : undefined;
      const impact = await userImpact(userId);
      const blockers = impact.filter(i => !['cascade', 'set null'].includes(i.onDelete));
      return {
        summary: `Delete user ${email} (#${userId}) and all their data`,
        lines: [
          ...impact.map(i => `${i.table}.${i.column}: ${i.count} row(s) -> ${i.onDelete}${i.children.length ? ` (also cascades to: ${i.children.join(', ')})` : ''}`),
          ...(impact.length ? [] : ['No dependent rows found.']),
          ...(blockers.length ? [`BLOCKED: ${blockers.map(b => b.table).join(', ')} reference this user without cascade; clear them first.`] : []),
        ],
        phrase: `DELETE ${email}`,
        refusal: refusal ?? (blockers.length ? 'Blocking references (see list)' : undefined),
      };
    }
    case 'analytics.purge': {
      const { days } = payload as { days: number };
      const c = await n('SELECT count(*) FROM analytics_events WHERE created_at < unixepoch() - ?', [days * 86400]);
      return { summary: `Purge analytics_events older than ${days} days (${c} rows now)`, lines: [`${c} rows currently match; the cutoff is recomputed when the action runs.`], phrase: `PURGE ${days}` };
    }
  }
}

export function parseDangerPayload(action: string, payload: unknown): { action: DangerAction; payload: unknown } {
  if (!(action in Payloads)) throw new Error(`Unknown action: ${action}`);
  return { action: action as DangerAction, payload: Payloads[action as DangerAction].parse(payload ?? {}) };
}

registerExecutor('table.wipe_reading_speed', async () => {
  const rs = await db.$client.execute('DELETE FROM reading_speed_attempts');
  return { deleted: rs.rowsAffected };
});

registerExecutor('batch.archive', async (raw) => {
  const { batch } = Payloads['batch.archive'].parse(raw);
  const ids = (await db.$client.execute({ sql: `SELECT id FROM users WHERE batch = ? AND role = 'student' AND status = 'active' AND lower(email) <> ?`, args: [batch, 'ahnaf816@gmail.com'] })).rows.map(r => Number(r.id));
  if (ids.length) await db.$client.execute({ sql: `UPDATE users SET status = 'inactive', updated_at = unixepoch() WHERE id IN (${ids.map(() => '?').join(',')})`, args: ids });
  return { archived: ids.length, userIds: ids };
});

registerExecutor('user.delete_full', async (raw) => {
  const { userId } = Payloads['user.delete_full'].parse(raw);
  const u = (await db.$client.execute({ sql: 'SELECT email, role FROM users WHERE id = ?', args: [userId] })).rows[0];
  if (!u) throw new Error('User no longer exists');
  if (isRootEmail(String(u.email)) || isStaffRole(String(u.role))) throw new Error('Refusing to delete a root/staff account');
  const blockers = (await userImpact(userId)).filter(i => !['cascade', 'set null'].includes(i.onDelete));
  if (blockers.length) throw new Error(`Blocked by: ${blockers.map(b => b.table).join(', ')}`);
  const rs = await db.$client.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [userId] }); // FK cascades do the rest (foreign_keys=1 on Turso)
  return { deletedUser: String(u.email), rows: rs.rowsAffected };
});

registerExecutor('analytics.purge', async (raw) => {
  const { days } = Payloads['analytics.purge'].parse(raw);
  const rs = await db.$client.execute({ sql: 'DELETE FROM analytics_events WHERE created_at < unixepoch() - ?', args: [days * 86400] });
  return { deleted: rs.rowsAffected, days };
});

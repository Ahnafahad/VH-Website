import { db } from '@/lib/db';
import { recordAudit } from '@/lib/audit-log';
import { validateReadOnlySql, PROTECTED_COLUMN } from './sql-validator';

export const SQL_ROW_CAP = 500;
const TIMEOUT_MS = 10_000;

export interface SqlResult { columns: string[]; rows: unknown[][]; truncated: boolean; ms: number; redacted: string[] }

/**
 * Validate, then run inside a read transaction that is ALWAYS rolled back (defense in depth —
 * the validator is the real boundary; Turso read transactions do not themselves reject writes).
 */
export async function runReadOnlySql(query: string, actorId: number): Promise<SqlResult> {
  const check = validateReadOnlySql(query);
  if (!check.ok) throw new Error(check.reason);
  const sqlText = check.kind === 'select' ? `SELECT * FROM (\n${check.sql}\n) LIMIT ${SQL_ROW_CAP + 1}` : check.sql;

  await recordAudit({ actorUserId: actorId, action: 'sql.read', entityType: 'sql', after: { query: query.slice(0, 1000) } });

  const started = Date.now();
  const tx = await db.$client.transaction('read');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const rs = await Promise.race([
      tx.execute(sqlText),
      new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error(`Query timed out after ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS); }),
    ]);
    const columns = rs.columns;
    const redactIdx = new Set(columns.flatMap((c, i) => (PROTECTED_COLUMN.test(c) ? [i] : [])));
    const truncated = rs.rows.length > SQL_ROW_CAP;
    const rows = rs.rows.slice(0, SQL_ROW_CAP).map(r =>
      columns.map((_, i) => {
        if (redactIdx.has(i)) return r[i] === null ? null : '[redacted]';
        const v = r[i] as unknown;
        if (typeof v === 'bigint') return v.toString();
        if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) return `[blob ${(v as ArrayBuffer).byteLength ?? 0} bytes]`;
        return v;
      }),
    );
    return { columns, rows, truncated, ms: Date.now() - started, redacted: [...redactIdx].map(i => columns[i]) };
  } finally {
    if (timer) clearTimeout(timer);
    try { await tx.rollback(); } catch { /* connection already gone */ }
    tx.close();
  }
}

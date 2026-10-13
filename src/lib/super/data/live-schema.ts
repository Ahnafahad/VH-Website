import { db } from '@/lib/db';
import type { SchemaMap } from './schema-drift';

const T = `m.type = 'table' AND m.name NOT LIKE 'sqlite_%'`;

/** Live structure of every table in one round trip (table-valued PRAGMA functions). */
export async function readLiveSchema(): Promise<SchemaMap> {
  const [cols, idx, idxCols] = await db.$client.batch([
    `SELECT m.name AS tbl, c.name AS col, c.type AS type, c."notnull" AS nn, c.cid AS cid FROM sqlite_master m, pragma_table_info(m.name) c WHERE ${T} ORDER BY m.name, c.cid`,
    `SELECT m.name AS tbl, il.name AS idx, il."unique" AS uniq FROM sqlite_master m, pragma_index_list(m.name) il WHERE ${T}`,
    `SELECT il.name AS idx, ii.name AS col, ii.seqno AS seq FROM sqlite_master m, pragma_index_list(m.name) il, pragma_index_info(il.name) ii WHERE ${T} ORDER BY il.name, ii.seqno`,
  ], 'read');

  const out: SchemaMap = {};
  const tbl = (n: string) => (out[n] ??= { columns: [], indexes: [] });
  for (const r of cols.rows) tbl(String(r.tbl)).columns.push({ name: String(r.col), type: String(r.type ?? '').toLowerCase(), notNull: Number(r.nn) === 1 });
  const colsByIdx = new Map<string, string[]>();
  for (const r of idxCols.rows) (colsByIdx.get(String(r.idx)) ?? colsByIdx.set(String(r.idx), []).get(String(r.idx))!).push(String(r.col));
  for (const r of idx.rows) tbl(String(r.tbl)).indexes.push({ name: String(r.idx), columns: colsByIdx.get(String(r.idx)) ?? [], unique: Number(r.uniq) === 1 });
  return out;
}

import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { is } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';

export interface ColInfo { name: string; type: string; notNull: boolean; pk?: boolean }
export interface TableInfo { columns: ColInfo[]; indexes: { name: string; columns: string[]; unique: boolean }[] }
export type SchemaMap = Record<string, TableInfo>;

export interface DriftRow { severity: 'high' | 'warn' | 'info'; kind: string; table: string; item: string; detail: string }

/** Expected structure, by introspecting every Drizzle table exported from schema.ts (no regex parsing). */
export function expectedSchema(mod: Record<string, unknown> = schema): SchemaMap {
  const out: SchemaMap = {};
  for (const v of Object.values(mod)) {
    if (!is(v, SQLiteTable)) continue;
    const cfg = getTableConfig(v);
    const indexes: TableInfo['indexes'] = [];
    for (const ix of cfg.indexes) {
      const cols = ix.config.columns.map(c => (c as { name?: string }).name).filter((n): n is string => !!n);
      indexes.push({ name: ix.config.name, columns: cols, unique: !!ix.config.unique });
    }
    // Unique constraints / unique columns have no declared name -> matched by column set.
    for (const u of cfg.uniqueConstraints) indexes.push({ name: u.name ?? '', columns: u.columns.map(c => c.name), unique: true });
    for (const c of cfg.columns) if (c.isUnique && !c.primary) indexes.push({ name: c.uniqueName ?? '', columns: [c.name], unique: true });
    out[cfg.name] = {
      columns: cfg.columns.map(c => ({ name: c.name, type: c.getSQLType().toLowerCase(), notNull: c.notNull, pk: c.primary })),
      indexes,
    };
  }
  return out;
}

const affinity = (t: string) => {
  const s = t.toLowerCase();
  if (s.includes('int')) return 'integer';
  if (/char|clob|text/.test(s)) return 'text';
  if (/real|floa|doub/.test(s)) return 'real';
  if (s === '' || s.includes('blob')) return 'blob';
  return 'numeric';
};

export function diffSchema(expected: SchemaMap, live: SchemaMap): DriftRow[] {
  const rows: DriftRow[] = [];
  for (const [table, exp] of Object.entries(expected)) {
    const lv = live[table];
    if (!lv) { rows.push({ severity: 'high', kind: 'missing table', table, item: table, detail: 'Declared in schema.ts, absent in live DB' }); continue; }
    const liveCols = new Map(lv.columns.map(c => [c.name, c]));
    for (const c of exp.columns) {
      const l = liveCols.get(c.name);
      if (!l) { rows.push({ severity: 'high', kind: 'missing column', table, item: c.name, detail: `Expected ${c.type}${c.notNull ? ' NOT NULL' : ''}` }); continue; }
      if (affinity(l.type) !== affinity(c.type)) rows.push({ severity: 'warn', kind: 'type mismatch', table, item: c.name, detail: `schema ${c.type}, live ${l.type || '(none)'}` });
      else if (!c.pk && l.notNull !== c.notNull) rows.push({ severity: 'warn', kind: 'nullability mismatch', table, item: c.name, detail: `schema ${c.notNull ? 'NOT NULL' : 'nullable'}, live ${l.notNull ? 'NOT NULL' : 'nullable'}` });
    }
    const expCols = new Set(exp.columns.map(c => c.name));
    for (const c of lv.columns) if (!expCols.has(c.name)) rows.push({ severity: 'info', kind: 'extra column', table, item: c.name, detail: 'In live DB, not in schema.ts' });

    const liveByName = new Map(lv.indexes.map(i => [i.name, i]));
    const sameCols = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
    const matched = new Set<string>();
    for (const ix of exp.indexes) {
      const hit = ix.name
        ? liveByName.get(ix.name)
        : lv.indexes.find(l => l.unique && sameCols(l.columns, ix.columns));
      if (!hit) { rows.push({ severity: 'warn', kind: 'missing index', table, item: ix.name || ix.columns.join(', '), detail: `${ix.unique ? 'UNIQUE ' : ''}(${ix.columns.join(', ')})` }); continue; }
      matched.add(hit.name);
      if (ix.name && !sameCols(hit.columns, ix.columns)) rows.push({ severity: 'warn', kind: 'index columns differ', table, item: ix.name, detail: `schema (${ix.columns.join(', ')}), live (${hit.columns.join(', ')})` });
    }
    for (const l of lv.indexes) if (!matched.has(l.name) && !l.name.startsWith('sqlite_autoindex_')) rows.push({ severity: 'info', kind: 'extra index', table, item: l.name, detail: `(${l.columns.join(', ')})` });
  }
  const ignored = /^(sqlite_|_litestream|libsql_|__drizzle)/;
  for (const table of Object.keys(live)) if (!expected[table] && !ignored.test(table)) rows.push({ severity: 'info', kind: 'extra table', table, item: table, detail: 'In live DB, not in schema.ts' });
  const rank = { high: 0, warn: 1, info: 2 };
  return rows.sort((a, b) => rank[a.severity] - rank[b.severity] || a.table.localeCompare(b.table));
}

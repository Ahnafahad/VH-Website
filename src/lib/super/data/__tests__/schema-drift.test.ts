import { describe, expect, it } from 'vitest';
import { diffSchema, expectedSchema, type SchemaMap } from '../schema-drift';

describe('schema drift', () => {
  it('introspects Drizzle tables, columns and indexes', () => {
    const exp = expectedSchema();
    expect(exp.users.columns.map(c => c.name)).toContain('email');
    expect(exp.users.columns.find(c => c.name === 'email')?.notNull).toBe(true);
    expect(exp.analytics_events.indexes.map(i => i.name)).toContain('idx_an_events_created');
    expect(exp.user_access.indexes.some(i => i.unique && i.columns.join() === 'user_id,product')).toBe(true);
  });

  it('reports missing/extra tables, columns, indexes with severity', () => {
    const expected: SchemaMap = {
      a: { columns: [{ name: 'id', type: 'integer', notNull: true }, { name: 'x', type: 'text', notNull: true }], indexes: [{ name: 'idx_a', columns: ['x'], unique: false }, { name: '', columns: ['x'], unique: true }] },
      b: { columns: [{ name: 'id', type: 'integer', notNull: true }], indexes: [] },
    };
    const live: SchemaMap = {
      a: { columns: [{ name: 'id', type: 'INTEGER'.toLowerCase(), notNull: true }, { name: 'y', type: 'text', notNull: false }], indexes: [{ name: 'idx_extra', columns: ['y'], unique: false }] },
      c: { columns: [], indexes: [] },
    };
    const rows = diffSchema(expected, live);
    const has = (kind: string, table: string, item: string) => rows.find(r => r.kind === kind && r.table === table && r.item === item);
    expect(has('missing table', 'b', 'b')?.severity).toBe('high');
    expect(has('missing column', 'a', 'x')?.severity).toBe('high');
    expect(has('extra column', 'a', 'y')?.severity).toBe('info');
    expect(has('missing index', 'a', 'idx_a')?.severity).toBe('warn');
    expect(has('missing index', 'a', 'x')?.severity).toBe('warn'); // unnamed unique constraint
    expect(has('extra index', 'a', 'idx_extra')).toBeTruthy();
    expect(has('extra table', 'c', 'c')).toBeTruthy();
    expect(rows[0].severity).toBe('high');
  });

  it('matches an unnamed unique constraint to a live auto/unique index by columns', () => {
    const expected: SchemaMap = { a: { columns: [{ name: 'x', type: 'text', notNull: false }], indexes: [{ name: '', columns: ['x'], unique: true }] } };
    const live: SchemaMap = { a: { columns: [{ name: 'x', type: 'text', notNull: false }], indexes: [{ name: 'a_x_unique', columns: ['x'], unique: true }] } };
    expect(diffSchema(expected, live)).toEqual([]);
  });
});

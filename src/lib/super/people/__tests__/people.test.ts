import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-utils', () => ({
  ApiException: class ApiException extends Error {
    status: number; code?: string;
    constructor(message: string, status = 500, code?: string) { super(message); this.status = status; this.code = code; }
  },
}));
vi.mock('@/lib/super/guard', () => ({ isRootEmail: (e: string) => e.toLowerCase() === 'ahnaf816@gmail.com' }));
vi.mock('@/lib/students/assign-student-id', () => ({
  last5: (s: string) => (/^\d{5,6}$/.test(s) ? Number(s) % 100000 : null),
}));

import { createClient } from '@libsql/client';
import { assertStaffChange } from '../guards';
import { checkStudentId } from '../student-id';
import { planRollover } from '../rollover';
import { applyMerge, previewMerge } from '../merge';

const t = (over = {}) => ({ id: 5, email: 'x@y.z', role: 'instructor', status: 'active', ...over });

describe('assertStaffChange', () => {
  it('refuses to touch the root account', () => {
    expect(() => assertStaffChange({ actorId: 2, target: t({ email: 'AHNAF816@gmail.com' }), change: { kind: 'teaching', value: true }, activeSuperAdmins: 3 })).toThrow(/root/);
  });
  it('refuses self role change / suspend / remove but allows self teaching toggle', () => {
    for (const change of [{ kind: 'role', role: 'student' }, { kind: 'suspend' }, { kind: 'remove' }] as const) {
      expect(() => assertStaffChange({ actorId: 5, target: t(), change, activeSuperAdmins: 3 })).toThrow(/own/);
    }
    expect(() => assertStaffChange({ actorId: 5, target: t(), change: { kind: 'teaching', value: true }, activeSuperAdmins: 3 })).not.toThrow();
  });
  it('protects the last active super admin', () => {
    const sa = t({ role: 'super_admin' });
    expect(() => assertStaffChange({ actorId: 9, target: sa, change: { kind: 'role', role: 'admin' }, activeSuperAdmins: 1 })).toThrow(/last/);
    expect(() => assertStaffChange({ actorId: 9, target: sa, change: { kind: 'remove' }, activeSuperAdmins: 1 })).toThrow(/last/);
    expect(() => assertStaffChange({ actorId: 9, target: sa, change: { kind: 'suspend' }, activeSuperAdmins: 1 })).toThrow(/last/);
    expect(() => assertStaffChange({ actorId: 9, target: sa, change: { kind: 'role', role: 'admin' }, activeSuperAdmins: 2 })).not.toThrow();
    expect(() => assertStaffChange({ actorId: 9, target: sa, change: { kind: 'role', role: 'super_admin' }, activeSuperAdmins: 1 })).not.toThrow();
  });
});

describe('checkStudentId', () => {
  it('validates shape and uniqueness incl. last-5 collisions', () => {
    expect(checkStudentId('12', [])).toMatch(/digits/);
    expect(checkStudentId('123456', ['123456'])).toMatch(/taken/);
    expect(checkStudentId('223456', ['123456'])).toMatch(/last 5/);
    expect(checkStudentId('654321', ['123456', null])).toBeNull();
  });
});

describe('planRollover', () => {
  const base = {
    product: 'iba', newBatch: '2027-28', oldBatch: '2026-27', archiveOld: true, copyAccess: true,
    batchRows: [{ name: '2026-27', product: 'iba', status: 'active' }],
    students: [
      { id: 1, role: 'student', status: 'active', batch: '2026-27', products: ['iba'] },
      { id: 2, role: 'student', status: 'active', batch: '2026-27', products: [] },
      { id: 3, role: 'student', status: 'active', batch: '2027-28', products: ['iba'] },
      { id: 4, role: 'instructor', status: 'active', batch: '2026-27', products: [] },
      { id: 5, role: 'student', status: 'inactive', batch: '2026-27', products: [] },
    ],
  };
  it('plans creation, archive, repoint, access and skips', () => {
    const p = planRollover(base);
    expect(p.createBatch).toBe(true);
    expect(p.archiveOld).toBe(true);
    expect(p.repoint).toEqual([1, 2]);
    expect(p.alreadyThere).toEqual([3]);
    expect(p.grantAccess).toEqual([2]);
    expect(p.skipped.map(s => s.id)).toEqual([4, 5]);
  });
  it('does not recreate an existing batch and does not archive when not asked', () => {
    const p = planRollover({ ...base, archiveOld: false, copyAccess: false, batchRows: [...base.batchRows, { name: '2027-28', product: 'iba', status: 'archived' }] });
    expect(p.createBatch).toBe(false);
    expect(p.reviveBatch).toBe(true);
    expect(p.archiveOld).toBe(false);
    expect(p.grantAccess).toEqual([]);
  });
});

describe('merge (in-memory libSQL)', () => {
  async function setup() {
    const c = createClient({ url: ':memory:' });
    await c.batch([
      'CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, status TEXT DEFAULT \'active\', student_id TEXT UNIQUE, notes TEXT, sessions_invalidated_at INTEGER, updated_at INTEGER)',
      'CREATE TABLE user_access (id INTEGER PRIMARY KEY, user_id INTEGER, product TEXT, active INTEGER DEFAULT 1, UNIQUE(user_id, product))',
      'CREATE TABLE test_attempts (id INTEGER PRIMARY KEY, user_id INTEGER, test_id INTEGER, UNIQUE(test_id, user_id))',
      'CREATE TABLE vocab_user_progress (id INTEGER PRIMARY KEY, user_id INTEGER UNIQUE, total_points INTEGER)',
      'CREATE TABLE registrations (id INTEGER PRIMARY KEY, email TEXT)',
      "INSERT INTO users (id, email, student_id) VALUES (1, 'dup@x.com', '111111'), (2, 'real@x.com', NULL)",
      "INSERT INTO user_access (user_id, product, active) VALUES (1, 'iba', 1), (2, 'iba', 0), (1, 'fbs', 1)",
      'INSERT INTO test_attempts (user_id, test_id) VALUES (1, 10), (1, 11), (2, 10)',
      'INSERT INTO vocab_user_progress (user_id, total_points) VALUES (1, 50)',
      "INSERT INTO registrations (email) VALUES ('DUP@x.com'), ('other@x.com')",
    ], 'write');
    return c;
  }
  it('previews counts with conflicts', async () => {
    const c = await setup();
    const p = await previewMerge(c, 1, 2);
    const by = Object.fromEntries(p.rows.map(r => [r.table, r]));
    expect(by.test_attempts).toMatchObject({ total: 2, conflicts: 1, moved: 1 });
    expect(by.user_access).toMatchObject({ total: 2, conflicts: 1, moved: 1 });
    expect(by.vocab_user_progress).toMatchObject({ total: 1, conflicts: 0, moved: 1 });
    expect(p.registrations).toBe(1);
  });
  it('applies atomically: moves rows, keeps conflicts on source, deactivates source', async () => {
    const c = await setup();
    await applyMerge(c, { id: 1, email: 'dup@x.com', studentId: '111111' }, { id: 2, email: 'real@x.com', studentId: null });
    const q = async (s: string) => (await c.execute(s)).rows.map(r => ({ ...r }));
    expect(await q('SELECT test_id FROM test_attempts WHERE user_id = 2 ORDER BY test_id')).toEqual([{ test_id: 10 }, { test_id: 11 }]);
    expect(await q('SELECT test_id FROM test_attempts WHERE user_id = 1')).toEqual([{ test_id: 10 }]);
    expect(await q('SELECT total_points FROM vocab_user_progress WHERE user_id = 2')).toEqual([{ total_points: 50 }]);
    expect(await q('SELECT product, active FROM user_access WHERE user_id = 2 ORDER BY product')).toEqual([{ product: 'fbs', active: 1 }, { product: 'iba', active: 1 }]);
    expect(await q('SELECT COUNT(*) AS n FROM user_access WHERE user_id = 1 AND active = 1')).toEqual([{ n: 0 }]);
    expect(await q("SELECT email FROM registrations ORDER BY id")).toEqual([{ email: 'real@x.com' }, { email: 'other@x.com' }]);
    const users = await q('SELECT id, status, student_id, notes FROM users ORDER BY id');
    expect(users[0]).toMatchObject({ status: 'inactive', student_id: null });
    expect(String(users[0].notes)).toContain('Merged into real@x.com');
    expect(users[1]).toMatchObject({ student_id: '111111' });
  });
});

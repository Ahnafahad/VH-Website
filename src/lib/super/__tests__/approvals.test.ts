import { beforeEach, describe, expect, it, vi } from 'vitest';

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/db', () => ({ get db() { return holder.db; } }));

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@/lib/db/schema';
import { proposeAction, cancelAction, runDueActions, executeActionNow, registerExecutor } from '../approvals';

const DDL = [
  `CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'student', status TEXT NOT NULL DEFAULT 'active')`,
  `CREATE TABLE super_pending_actions (id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, payload TEXT NOT NULL, summary TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'pending', requested_by INTEGER, execute_after INTEGER NOT NULL, resolved_at INTEGER, result TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch()))`,
  `CREATE TABLE audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_user_id INTEGER, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id INTEGER, before TEXT, after TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch()))`,
];

let calls = 0;
const status = async (id: number) =>
  (await (holder.db as ReturnType<typeof drizzle>).select().from(schema.superPendingActions).all()).find(r => r.id === id)!;

beforeEach(async () => {
  const client = createClient({ url: ':memory:' });
  for (const s of DDL) await client.execute(s);
  await client.execute("INSERT INTO users (id, email, name, role) VALUES (1, 'root@x.com', 'Root', 'super_admin')");
  holder.db = drizzle(client, { schema });
  calls = 0;
  registerExecutor('test.ok', async (payload) => { calls++; await new Promise(r => setTimeout(r, 10)); return { echoed: payload }; });
  registerExecutor('test.boom', async () => { throw new Error('nope'); });
});

describe('approvals', () => {
  it('rejects unknown actions', async () => {
    await expect(proposeAction({ action: 'nope', payload: {}, summary: 's', actorId: 1 })).rejects.toThrow(/Unknown/);
  });

  it('does not run before the delay, runs once after, even with concurrent runners', async () => {
    const id = await proposeAction({ action: 'test.ok', payload: { a: 1 }, summary: 's', actorId: 1, delayMinutes: 15 });
    expect(await runDueActions()).toEqual({ ran: 0, failed: 0 });
    expect(calls).toBe(0);

    await (holder.db as ReturnType<typeof drizzle>).update(schema.superPendingActions).set({ executeAfter: new Date(Date.now() - 1000) });
    const [a, b] = await Promise.all([runDueActions(), runDueActions()]);
    expect(a.ran + b.ran).toBe(1);
    expect(calls).toBe(1);
    const row = await status(id);
    expect(row.status).toBe('executed');
    expect(JSON.parse(row.result!)).toEqual({ echoed: { a: 1 } });
    expect(await runDueActions()).toEqual({ ran: 0, failed: 0 });
  });

  it('cancel prevents execution; executed rows cannot be cancelled', async () => {
    const id = await proposeAction({ action: 'test.ok', payload: {}, summary: 's', actorId: 1, delayMinutes: 0 });
    expect(await cancelAction(id, 1)).toBe(true);
    expect(await runDueActions()).toEqual({ ran: 0, failed: 0 });
    expect(await executeActionNow(id)).toBe('skipped');
    const id2 = await proposeAction({ action: 'test.ok', payload: {}, summary: 's', actorId: 1 });
    expect(await executeActionNow(id2)).toBe('executed');
    expect(await cancelAction(id2, 1)).toBe(false);
  });

  it('records failures', async () => {
    const id = await proposeAction({ action: 'test.boom', payload: {}, summary: 's', actorId: 1, delayMinutes: 0 });
    expect(await runDueActions()).toEqual({ ran: 0, failed: 1 });
    const row = await status(id);
    expect(row.status).toBe('failed');
    expect(row.result).toContain('nope');
  });

  it('fails a queued action whose proposer is no longer an active super admin', async () => {
    const id = await proposeAction({ action: 'test.ok', payload: {}, summary: 's', actorId: 1, delayMinutes: 0 });
    await (holder.db as ReturnType<typeof drizzle>).$client.execute("UPDATE users SET role = 'admin' WHERE id = 1");
    await runDueActions();
    expect(calls).toBe(0);
    expect((await status(id)).status).toBe('failed');
  });
});

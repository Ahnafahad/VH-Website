/**
 * lmsAnnouncementScopeConditions — the dedicated visibility rule for
 * lms_announcements (targetUserIds), exercised against an in-memory libSQL
 * database so the json_each containment check actually runs through SQLite,
 * not just gets asserted on the JS side.
 *
 * Rule under test:
 *   staff                                        → see everything (not exercised here — caller's job)
 *   targetUserIds IS NULL                        → normal cohort rule (product + batch)
 *   targetUserIds contains this user's id         → visible regardless of cohort
 *   targetUserIds set but does NOT contain them   → NOT visible (no leak to the batch)
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { and } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';
import { lmsAnnouncements } from '@/lib/db/schema';
import type { UserWithProducts } from '@/lib/db/schema';
import { lmsAnnouncementScopeConditions } from '../access';

function makeDb() {
  const client = createClient({ url: ':memory:' });
  return { client, db: drizzle(client, { schema }) };
}

async function createSchema(client: ReturnType<typeof createClient>) {
  await client.executeMultiple(`
    CREATE TABLE lms_announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      subject TEXT NOT NULL,
      product TEXT NOT NULL DEFAULT 'iba',
      batch TEXT,
      target_user_ids TEXT,
      pinned INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
}

function student(overrides: Partial<UserWithProducts> = {}): UserWithProducts {
  return {
    id: 42,
    email: 'student@example.com',
    name: 'Student',
    image: null,
    role: 'student',
    status: 'active',
    batch: '2026',
    createdAt: new Date(),
    updatedAt: new Date(),
    products: ['iba'],
    ...overrides,
  } as UserWithProducts;
}

let ctx: ReturnType<typeof makeDb>;

beforeEach(async () => {
  ctx = makeDb();
  await createSchema(ctx.client);
});

async function insertAnnouncement(opts: {
  batch?: string | null;
  targetUserIds?: number[] | null;
  product?: string;
}) {
  const [row] = await ctx.db.insert(lmsAnnouncements).values({
    title: 'Test',
    body: 'Body',
    subject: 'english',
    product: opts.product ?? 'iba',
    batch: opts.batch ?? null,
    targetUserIds: opts.targetUserIds ? JSON.stringify(opts.targetUserIds) : null,
    createdBy: 1,
  }).returning();
  return row.id;
}

async function visibleTo(user: UserWithProducts) {
  const rows = await ctx.db
    .select({ id: lmsAnnouncements.id })
    .from(lmsAnnouncements)
    .where(and(...lmsAnnouncementScopeConditions(user)));
  return rows.map(r => r.id);
}

describe('lmsAnnouncementScopeConditions', () => {
  it('a cohort announcement (targetUserIds NULL) is visible to the batch', async () => {
    const id = await insertAnnouncement({ batch: '2026', targetUserIds: null });
    const ids = await visibleTo(student({ batch: '2026' }));
    expect(ids).toContain(id);
  });

  it('an individually-targeted announcement is visible to a targeted user', async () => {
    const id = await insertAnnouncement({ batch: '2026', targetUserIds: [42, 7] });
    const ids = await visibleTo(student({ id: 42, batch: '2026' }));
    expect(ids).toContain(id);
  });

  it('the same individually-targeted announcement is NOT visible to an untargeted user in the same batch (no leak)', async () => {
    const id = await insertAnnouncement({ batch: '2026', targetUserIds: [42, 7] });
    const ids = await visibleTo(student({ id: 99, batch: '2026' }));
    expect(ids).not.toContain(id);
  });

  it('an individually-targeted announcement is visible to a targeted user EVEN OUTSIDE their cohort batch', async () => {
    const id = await insertAnnouncement({ batch: '2025', targetUserIds: [42] });
    const ids = await visibleTo(student({ id: 42, batch: '2026' }));
    expect(ids).toContain(id);
  });

  it('a cohort announcement for a different batch stays invisible', async () => {
    const id = await insertAnnouncement({ batch: '2025', targetUserIds: null });
    const ids = await visibleTo(student({ batch: '2026' }));
    expect(ids).not.toContain(id);
  });

  it('staff bypass returns no filter (empty condition array) — caller applies it as "see everything"', () => {
    const staffUser = student({ role: 'super_admin', products: [] });
    expect(lmsAnnouncementScopeConditions(staffUser)).toEqual([]);
  });
});

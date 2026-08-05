/**
 * resolveAudience is the single audience-resolution path for the email
 * announcement blast, the LMS announcement feed's push dispatch, and any
 * future channel — this test exercises the real function against a local,
 * in-memory libSQL database (`:memory:`, no network, not Turso) seeded with
 * fixture rows. It never touches the production database, and never calls
 * any email/push sending code.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@/lib/db/schema';
import { users, userAccess } from '@/lib/db/schema';
import { resolveAudience } from '../resolve';

// ─── In-memory fixture DB ───────────────────────────────────────────────────
// Only the columns resolveAudience's queries actually touch — a real Turso
// migration is not needed to unit-test this function.

function makeTestDb() {
  const client = createClient({ url: ':memory:' });
  return { client, db: drizzle(client, { schema }) };
}

let db: ReturnType<typeof makeTestDb>['db'];

beforeEach(async () => {
  const testDb = makeTestDb();
  db = testDb.db;

  // Full column set mirroring src/lib/db/schema.ts — drizzle's insert builder
  // references every schema-defined column (passing NULL/defaults for ones
  // not set in a given fixture), so the in-memory table needs all of them,
  // not just the subset resolveAudience's queries read.
  await testDb.client.executeMultiple(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL,
      student_id TEXT UNIQUE,
      batch TEXT,
      class TEXT,
      notes TEXT,
      whatsapp TEXT,
      is_teaching INTEGER,
      avatar_character_id INTEGER,
      avatar_custom_request TEXT,
      avatar_request_status TEXT,
      onboarding_skips INTEGER NOT NULL,
      onboarded_at INTEGER,
      push_subscription TEXT,
      notify_materials INTEGER NOT NULL,
      notify_announcements INTEGER NOT NULL,
      notify_comment_reply INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE user_access (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product TEXT NOT NULL,
      active INTEGER NOT NULL,
      granted_at INTEGER NOT NULL,
      granted_by INTEGER
    );
  `);

  // ── Fixtures ────────────────────────────────────────────────────────────
  const [ana, bilal, carol, dana, eve, farhan, gita] = await db
    .insert(users)
    .values([
      { email: 'ana@test.com',    name: 'Ana',    role: 'student', status: 'active',   batch: '2026-27', pushSubscription: null, notifyMaterials: true, notifyAnnouncements: true, notifyCommentReply: true },
      { email: 'bilal@test.com',  name: 'Bilal',  role: 'student', status: 'active',   batch: '2025-26', pushSubscription: null, notifyMaterials: true, notifyAnnouncements: true, notifyCommentReply: true },
      { email: 'carol@test.com',  name: 'Carol',  role: 'admin',   status: 'active',   batch: null,      pushSubscription: null, notifyMaterials: true, notifyAnnouncements: true, notifyCommentReply: true },
      { email: 'dana@test.com',   name: 'Dana',   role: 'student', status: 'inactive', batch: '2026-27', pushSubscription: null, notifyMaterials: true, notifyAnnouncements: true, notifyCommentReply: true },
      { email: 'eve@test.com',    name: 'Eve',    role: 'student', status: 'active',   batch: null,      pushSubscription: null, notifyMaterials: true, notifyAnnouncements: true, notifyCommentReply: true },
      { email: 'farhan@test.com', name: 'Farhan', role: 'student', status: 'active',   batch: '2024-25', pushSubscription: null, notifyMaterials: true, notifyAnnouncements: true, notifyCommentReply: true },
      { email: 'gita@test.com',   name: 'Gita',   role: 'student', status: 'active',   batch: '2026-27', pushSubscription: null, notifyMaterials: true, notifyAnnouncements: true, notifyCommentReply: true },
    ])
    .returning();

  await db.insert(userAccess).values([
    { userId: ana.id,    product: 'iba', active: true }, // iba, batch 2026-27
    { userId: bilal.id,  product: 'fbs', active: true }, // fbs, batch 2025-26
    { userId: dana.id,   product: 'iba', active: true }, // iba, batch 2026-27 — but INACTIVE user
    { userId: eve.id,    product: 'iba', active: true }, // iba, batch null (no batch)
    { userId: farhan.id, product: 'fbs', active: true }, // fbs, batch 2024-25
    { userId: gita.id,   product: 'fbs', active: true }, // fbs, batch 2026-27 — same batch as Ana, different product
  ]);

  fixtureIds = { ana: ana.id, bilal: bilal.id, carol: carol.id, dana: dana.id, eve: eve.id, farhan: farhan.id, gita: gita.id };
});

let fixtureIds: Record<'ana' | 'bilal' | 'carol' | 'dana' | 'eve' | 'farhan' | 'gita', number>;

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('resolveAudience — everyone', () => {
  it('returns every non-inactive user regardless of role, excluding the inactive one', async () => {
    const recipients = await resolveAudience(db, { mode: 'everyone' });
    const emails = recipients.map(r => r.email).sort();
    expect(emails).toEqual(['ana@test.com', 'bilal@test.com', 'carol@test.com', 'eve@test.com', 'farhan@test.com', 'gita@test.com']);
    expect(emails).not.toContain('dana@test.com'); // inactive
  });
});

describe('resolveAudience — batchProduct: one batch', () => {
  it('matches only students in that exact batch, excluding batch-null and other-batch students', async () => {
    const recipients = await resolveAudience(db, { mode: 'batchProduct', product: 'iba', batch: '2026-27' });
    expect(recipients.map(r => r.email)).toEqual(['ana@test.com']);
  });
});

describe('resolveAudience — batchProduct: one product (batch = null → all batches of that product)', () => {
  it('matches every active student holding that product, across different batches', async () => {
    const recipients = await resolveAudience(db, { mode: 'batchProduct', product: 'fbs', batch: null });
    const emails = recipients.map(r => r.email).sort();
    expect(emails).toEqual(['bilal@test.com', 'farhan@test.com', 'gita@test.com']);
  });
});

describe('resolveAudience — batchProduct: batch × product combined', () => {
  it('requires BOTH to match — same batch but wrong product is excluded', async () => {
    // Gita shares Ana's batch (2026-27) but holds fbs, not iba.
    const recipients = await resolveAudience(db, { mode: 'batchProduct', product: 'iba', batch: '2026-27' });
    expect(recipients.map(r => r.email)).toEqual(['ana@test.com']);
    expect(recipients.map(r => r.email)).not.toContain('gita@test.com');
  });

  it('excludes an inactive user even when batch and product both match', async () => {
    // Dana matches iba/2026-27 exactly like Ana, but is inactive.
    const recipients = await resolveAudience(db, { mode: 'batchProduct', product: 'iba', batch: '2026-27' });
    expect(recipients.map(r => r.email)).not.toContain('dana@test.com');
  });
});

describe('resolveAudience — individuals: a list of named individuals', () => {
  it('returns exactly the named users, regardless of role or status', async () => {
    const recipients = await resolveAudience(db, {
      mode: 'individuals',
      userIds: [fixtureIds.bilal, fixtureIds.carol],
    });
    const emails = recipients.map(r => r.email).sort();
    expect(emails).toEqual(['bilal@test.com', 'carol@test.com']);
  });
});

describe('resolveAudience — empty / no-match selections resolve to ZERO recipients, never "everyone"', () => {
  it('individuals with an empty id list resolves to zero recipients', async () => {
    const recipients = await resolveAudience(db, { mode: 'individuals', userIds: [] });
    expect(recipients).toEqual([]);
  });

  it('individuals with ids that do not exist resolve to zero recipients', async () => {
    const recipients = await resolveAudience(db, { mode: 'individuals', userIds: [999999] });
    expect(recipients).toEqual([]);
  });

  it('batchProduct with no matching students resolves to zero recipients', async () => {
    const recipients = await resolveAudience(db, { mode: 'batchProduct', product: 'fbs_detailed', batch: null });
    expect(recipients).toEqual([]);
  });

  it('a zero-match selection never falls back to the full user set', async () => {
    const everyone = await resolveAudience(db, { mode: 'everyone' });
    const noMatch  = await resolveAudience(db, { mode: 'batchProduct', product: 'fbs_detailed', batch: null });
    expect(noMatch.length).toBe(0);
    expect(noMatch.length).not.toBe(everyone.length);
  });
});

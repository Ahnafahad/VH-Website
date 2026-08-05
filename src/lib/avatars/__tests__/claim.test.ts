/**
 * claimAvatarCharacter against a real in-memory libSQL database (`:memory:`,
 * no network, not Turso) — including the actual UNIQUE INDEX on
 * users.avatar_character_id, so the race-condition path is exercised against
 * a genuine constraint violation, not a mock.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';
import { users, avatarCharacters } from '@/lib/db/schema';
import { claimAvatarCharacter } from '../claim';

function makeTestDb() {
  const client = createClient({ url: ':memory:' });
  return { client, db: drizzle(client, { schema }) };
}

let db: ReturnType<typeof makeTestDb>['db'];
let ben: number;
let l: number;
let ahnaf: number;
let hasan: number;

beforeEach(async () => {
  const testDb = makeTestDb();
  db = testDb.db;

  // Full column set mirroring src/lib/db/schema.ts's users table (see
  // src/lib/audience/__tests__/resolve.test.ts for the same convention) plus
  // avatar_characters, plus the real unique index this test depends on.
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
    CREATE UNIQUE INDEX users_avatar_character_unique ON users (avatar_character_id);
    CREATE TABLE avatar_characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      gender TEXT NOT NULL,
      source TEXT NOT NULL,
      origin TEXT,
      image_url TEXT,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  const [benRow, lRow] = await db
    .insert(avatarCharacters)
    .values([
      { name: 'Ben 10', gender: 'male', source: 'tv', status: 'available', createdAt: new Date() },
      { name: 'L', gender: 'male', source: 'anime', origin: 'Death Note', status: 'available', createdAt: new Date() },
    ])
    .returning();
  ben = benRow.id;
  l = lRow.id;

  const [ahnafRow, hasanRow] = await db
    .insert(users)
    .values([
      { email: 'ahnaf@test.com', name: 'Ahnaf', role: 'student', status: 'active', onboardingSkips: 0, notifyMaterials: true, notifyAnnouncements: true, notifyCommentReply: true },
      { email: 'hasan@test.com', name: 'Hasan', role: 'student', status: 'active', onboardingSkips: 0, notifyMaterials: true, notifyAnnouncements: true, notifyCommentReply: true },
    ])
    .returning();
  ahnaf = ahnafRow.id;
  hasan = hasanRow.id;
});

describe('claimAvatarCharacter — happy path', () => {
  it('claiming a free character succeeds and persists the choice', async () => {
    const result = await claimAvatarCharacter(db, ahnaf, ben);
    expect(result).toEqual({ ok: true });

    const row = await db.select({ avatarCharacterId: users.avatarCharacterId }).from(users).where(eq(users.id, ahnaf)).get();
    expect(row?.avatarCharacterId).toBe(ben);
  });
});

describe('claimAvatarCharacter — already claimed by someone else', () => {
  it('fails with a clear "taken" reason, not an exception', async () => {
    const first = await claimAvatarCharacter(db, ahnaf, ben);
    expect(first).toEqual({ ok: true });

    // Hasan tries to claim the same character Ahnaf just took.
    const second = await claimAvatarCharacter(db, hasan, ben);
    expect(second).toEqual({ ok: false, reason: 'taken' });

    // Hasan's row is untouched.
    const row = await db.select({ avatarCharacterId: users.avatarCharacterId }).from(users).where(eq(users.id, hasan)).get();
    expect(row?.avatarCharacterId).toBeNull();
  });
});

describe('claimAvatarCharacter — a student who already holds a character', () => {
  it('cannot claim a second one', async () => {
    const first = await claimAvatarCharacter(db, ahnaf, ben);
    expect(first).toEqual({ ok: true });

    const second = await claimAvatarCharacter(db, ahnaf, l);
    expect(second).toEqual({ ok: false, reason: 'already_has' });

    // Ahnaf still holds Ben 10, not L.
    const row = await db.select({ avatarCharacterId: users.avatarCharacterId }).from(users).where(eq(users.id, ahnaf)).get();
    expect(row?.avatarCharacterId).toBe(ben);
  });
});

describe('claimAvatarCharacter — unknown character', () => {
  it('fails with "not_found" rather than throwing', async () => {
    const result = await claimAvatarCharacter(db, ahnaf, 999999);
    expect(result).toEqual({ ok: false, reason: 'not_found' });
  });
});

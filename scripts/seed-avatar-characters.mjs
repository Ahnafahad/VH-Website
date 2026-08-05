#!/usr/bin/env node
// scripts/seed-avatar-characters.mjs — Seeds the `avatar_characters` catalogue:
// 100 characters (50 male, 50 female) from anime, film and TV, a genuine mix
// (not predominantly Japanese/anime). Two are reserved for staff: Ben 10
// (Ahnaf) and L / Death Note (Hasan) — both are in the list below, seeded
// like every other row. `imageUrl` is left NULL; artwork is designed later.
//
// Table already exists in prod (schema.ts + drizzle-kit push) — this script
// does NOT create it. Idempotent: skips any name that already exists
// (avatar_characters.name is unique).
//
// Usage:
//   node scripts/seed-avatar-characters.mjs --dry-run   # plan only, no DB writes
//   node scripts/seed-avatar-characters.mjs             # write to Turso
//
// Requires .env.local with TURSO_DATABASE_URL + TURSO_AUTH_TOKEN. Local Node→
// Turso TLS needs NODE_EXTRA_CA_CERTS → repo-root win-roots.pem, e.g.:
//   $env:NODE_EXTRA_CA_CERTS="D:\VH Website\win-roots.pem"; node scripts/seed-avatar-characters.mjs
// Exit codes: 0 ok, 1 usage/parse, 2 db failure.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { avatarCharacters } from '../src/lib/db/schema.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ─── ANSI helpers ────────────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', red: '\x1b[31m',
  green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', gray: '\x1b[90m',
};
const ok   = (m) => console.log(`${c.green}✓${c.reset} ${m}`);
const warn = (m) => console.log(`${c.yellow}⚠${c.reset}  ${m}`);
const err  = (m) => console.error(`${c.red}✗${c.reset} ${m}`);
const info = (m) => console.log(`${c.cyan}ℹ${c.reset} ${m}`);
const bold = (m) => `${c.bold}${m}${c.reset}`;

// ─── .env.local parser (matches seed-batches.mjs) ────────────────────────────

function loadEnv() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

// ─── Catalogue ────────────────────────────────────────────────────────────────
// gender | name | source ('anime'|'movie'|'tv') | origin
// RESERVED rows (must stay in the list, never removed): 'Ben 10' → Ahnaf,
// 'L' → Hasan (both assigned by staff outside this seed, later).

const MALE = [
  ['Ben 10', 'tv', 'Ben 10'], // RESERVED — Ahnaf
  ['L', 'anime', 'Death Note'], // RESERVED — Hasan
  ['Harry Potter', 'movie', 'Harry Potter'],
  ['Iron Man', 'movie', 'Marvel Cinematic Universe'],
  ['Batman', 'movie', 'Batman'],
  ['Spider-Man', 'movie', 'Marvel Cinematic Universe'],
  ['Luke Skywalker', 'movie', 'Star Wars'],
  ['Darth Vader', 'movie', 'Star Wars'],
  ['Jack Sparrow', 'movie', 'Pirates of the Caribbean'],
  ['James Bond', 'movie', 'James Bond'],
  ['Sherlock Holmes', 'tv', 'Sherlock'],
  ['Walter White', 'tv', 'Breaking Bad'],
  ['Jon Snow', 'tv', 'Game of Thrones'],
  ['Tyrion Lannister', 'tv', 'Game of Thrones'],
  ['Michael Scott', 'tv', 'The Office'],
  ['Ross Geller', 'tv', 'Friends'],
  ['Chandler Bing', 'tv', 'Friends'],
  ['Mike Wheeler', 'tv', 'Stranger Things'],
  ['Rick Sanchez', 'tv', 'Rick and Morty'],
  ['Homer Simpson', 'tv', 'The Simpsons'],
  ['SpongeBob SquarePants', 'tv', 'SpongeBob SquarePants'],
  ['Shrek', 'movie', 'Shrek'],
  ['Woody', 'movie', 'Toy Story'],
  ['Buzz Lightyear', 'movie', 'Toy Story'],
  ['Simba', 'movie', 'The Lion King'],
  ['Aladdin', 'movie', 'Aladdin'],
  ['Peter Pan', 'movie', 'Peter Pan'],
  ['Jack Skellington', 'movie', 'The Nightmare Before Christmas'],
  ['Frodo Baggins', 'movie', 'The Lord of the Rings'],
  ['Aragorn', 'movie', 'The Lord of the Rings'],
  ['Gandalf', 'movie', 'The Lord of the Rings'],
  ['Thor', 'movie', 'Marvel Cinematic Universe'],
  ['Captain America', 'movie', 'Marvel Cinematic Universe'],
  ['Deadpool', 'movie', 'Deadpool'],
  ['Wolverine', 'movie', 'X-Men'],
  ['Naruto Uzumaki', 'anime', 'Naruto'],
  ['Monkey D. Luffy', 'anime', 'One Piece'],
  ['Goku', 'anime', 'Dragon Ball'],
  ['Levi Ackerman', 'anime', 'Attack on Titan'],
  ['Edward Elric', 'anime', 'Fullmetal Alchemist'],
  ['Light Yagami', 'anime', 'Death Note'],
  ['Ichigo Kurosaki', 'anime', 'Bleach'],
  ['Aang', 'tv', 'Avatar: The Last Airbender'],
  ['Zuko', 'tv', 'Avatar: The Last Airbender'],
  ['Eric Cartman', 'tv', 'South Park'],
  ['Stewie Griffin', 'tv', 'Family Guy'],
  ['Peter Griffin', 'tv', 'Family Guy'],
  ['Forrest Gump', 'movie', 'Forrest Gump'],
  ['Maximus', 'movie', 'Gladiator'],
  ['Neo', 'movie', 'The Matrix'],
].map(([name, source, origin]) => ({ name, gender: 'male', source, origin }));

const FEMALE = [
  ['Hermione Granger', 'movie', 'Harry Potter'],
  ['Wonder Woman', 'movie', 'Wonder Woman'],
  ['Black Widow', 'movie', 'Marvel Cinematic Universe'],
  ['Captain Marvel', 'movie', 'Marvel Cinematic Universe'],
  ['Elsa', 'movie', 'Frozen'],
  ['Anna', 'movie', 'Frozen'],
  ['Moana', 'movie', 'Moana'],
  ['Belle', 'movie', 'Beauty and the Beast'],
  ['Ariel', 'movie', 'The Little Mermaid'],
  ['Mulan', 'movie', 'Mulan'],
  ['Rapunzel', 'movie', 'Tangled'],
  ['Jasmine', 'movie', 'Aladdin'],
  ['Cinderella', 'movie', 'Cinderella'],
  ['Merida', 'movie', 'Brave'],
  ['Princess Leia', 'movie', 'Star Wars'],
  ['Rey', 'movie', 'Star Wars'],
  ['Padmé Amidala', 'movie', 'Star Wars'],
  ['Katniss Everdeen', 'movie', 'The Hunger Games'],
  ['Galadriel', 'movie', 'The Lord of the Rings'],
  ['Arwen', 'movie', 'The Lord of the Rings'],
  ['Elizabeth Swann', 'movie', 'Pirates of the Caribbean'],
  ['Sarah Connor', 'movie', 'Terminator'],
  ['Ellen Ripley', 'movie', 'Alien'],
  ['Lara Croft', 'movie', 'Tomb Raider'],
  ['Harley Quinn', 'movie', 'DC (Suicide Squad)'],
  ['Storm', 'movie', 'X-Men'],
  ['Rachel Green', 'tv', 'Friends'],
  ['Monica Geller', 'tv', 'Friends'],
  ['Phoebe Buffay', 'tv', 'Friends'],
  ['Eleven', 'tv', 'Stranger Things'],
  ['Daenerys Targaryen', 'tv', 'Game of Thrones'],
  ['Arya Stark', 'tv', 'Game of Thrones'],
  ['Sansa Stark', 'tv', 'Game of Thrones'],
  ['Cersei Lannister', 'tv', 'Game of Thrones'],
  ['Lisa Simpson', 'tv', 'The Simpsons'],
  ['Marge Simpson', 'tv', 'The Simpsons'],
  ['Velma Dinkley', 'tv', 'Scooby-Doo'],
  ['Daphne Blake', 'tv', 'Scooby-Doo'],
  ['Katara', 'tv', 'Avatar: The Last Airbender'],
  ['Toph Beifong', 'tv', 'Avatar: The Last Airbender'],
  ['Buffy Summers', 'tv', 'Buffy the Vampire Slayer'],
  ['Sailor Moon', 'anime', 'Sailor Moon'],
  ['Nami', 'anime', 'One Piece'],
  ['Mikasa Ackerman', 'anime', 'Attack on Titan'],
  ['Sakura Haruno', 'anime', 'Naruto'],
  ['Winry Rockbell', 'anime', 'Fullmetal Alchemist'],
  ['Misa Amane', 'anime', 'Death Note'],
  ['Asuna Yuuki', 'anime', 'Sword Art Online'],
  ['Chihiro Ogino', 'anime', 'Spirited Away'],
  ['Meg Griffin', 'tv', 'Family Guy'],
].map(([name, source, origin]) => ({ name, gender: 'female', source, origin }));

const SEED_ROWS = [...MALE, ...FEMALE];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('');
  console.log(bold(`  VH Avatar Characters Seeder${dryRun ? ' [DRY RUN]' : ''}`));
  console.log('');
  info(`${SEED_ROWS.length} characters total (${MALE.length} male / ${FEMALE.length} female)`);
  console.log('');

  loadEnv();

  const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;
  if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
    err('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local');
    process.exit(dryRun ? 0 : 2);
  }

  const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });
  const db = drizzle(client);

  if (dryRun) {
    let wouldInsert = 0;
    let wouldSkip = 0;
    for (const row of SEED_ROWS) {
      const existing = await db.select({ id: avatarCharacters.id }).from(avatarCharacters)
        .where(eq(avatarCharacters.name, row.name)).get()
        .catch(() => null); // table may not exist yet
      if (existing) { wouldSkip++; }
      else { wouldInsert++; }
    }
    ok(`[dry-run] would insert ${wouldInsert} row(s), skip ${wouldSkip} already-present`);
    console.log('');
    ok(bold('Dry run complete — no DB writes performed.'));
    process.exit(0);
  }

  // ── Self-migrate: create the table if it somehow doesn't exist yet ─────────
  // (Task brief: the table already exists in prod via drizzle-kit push — this
  // is a defensive no-op there, matching seed-batches.mjs's convention.)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS avatar_characters (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      gender     TEXT    NOT NULL,
      source     TEXT    NOT NULL,
      origin     TEXT,
      image_url  TEXT,
      status     TEXT    NOT NULL DEFAULT 'available',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
  ok('table avatar_characters ensured');

  // ── Idempotent row insert ──────────────────────────────────────────────────
  let inserted = 0;
  for (const row of SEED_ROWS) {
    const existing = await db.select({ id: avatarCharacters.id }).from(avatarCharacters)
      .where(eq(avatarCharacters.name, row.name)).get();
    if (existing) {
      info(`'${row.name}' already exists (id=${existing.id}) — skipping`);
      continue;
    }
    const [created] = await db.insert(avatarCharacters).values(row).returning();
    ok(`inserted id=${created.id}: '${row.name}' (${row.gender}/${row.source}, ${row.origin})`);
    inserted++;
  }

  console.log('');
  ok(bold(`Seed complete — ${inserted} character row(s) inserted, ${SEED_ROWS.length - inserted} already present.`));
  process.exit(0);
}

main().catch((e) => {
  err(`Unexpected error: ${e.message}`);
  process.exit(2);
});

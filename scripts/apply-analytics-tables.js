/**
 * One-off: create the two analytics tables (+ indexes) in Turso.
 * Surgical and idempotent — uses IF NOT EXISTS, touches nothing else.
 * Run: node scripts/apply-analytics-tables.js
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');

// Load .env.local (same approach as drizzle.config.ts)
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const [k, ...rest] = t.split('=');
    if (k && rest.length) process.env[k.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
  }
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const statements = [
  `CREATE TABLE IF NOT EXISTS analytics_sessions (
    id text PRIMARY KEY NOT NULL,
    anon_id text NOT NULL,
    user_id integer REFERENCES users(id) ON DELETE set null,
    is_authenticated integer DEFAULT false NOT NULL,
    entry_path text,
    exit_path text,
    referrer text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    device text,
    user_agent text,
    page_count integer DEFAULT 0 NOT NULL,
    event_count integer DEFAULT 0 NOT NULL,
    duration_ms integer DEFAULT 0 NOT NULL,
    started_at integer DEFAULT (unixepoch()) NOT NULL,
    last_seen_at integer DEFAULT (unixepoch()) NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_an_sessions_started ON analytics_sessions (started_at)`,
  `CREATE INDEX IF NOT EXISTS idx_an_sessions_user ON analytics_sessions (user_id, started_at)`,
  `CREATE INDEX IF NOT EXISTS idx_an_sessions_anon ON analytics_sessions (anon_id)`,
  `CREATE TABLE IF NOT EXISTS analytics_events (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    session_id text NOT NULL,
    anon_id text NOT NULL,
    user_id integer REFERENCES users(id) ON DELETE set null,
    type text NOT NULL,
    module text,
    path text,
    name text,
    props text,
    duration_ms integer,
    created_at integer DEFAULT (unixepoch()) NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_an_events_created ON analytics_events (created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_an_events_type_created ON analytics_events (type, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_an_events_module_created ON analytics_events (module, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_an_events_user_created ON analytics_events (user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_an_events_session ON analytics_events (session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_an_events_name ON analytics_events (name)`,
];

(async () => {
  console.log('Applying analytics tables to:', process.env.TURSO_DATABASE_URL);
  for (const sql of statements) {
    await client.execute(sql);
    console.log('  ok:', sql.split('\n')[0].slice(0, 60));
  }
  const check = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'analytics_%' ORDER BY name"
  );
  console.log('Analytics tables now present:', check.rows.map(r => r.name));
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });

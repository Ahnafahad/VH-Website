/**
 * Shared in-memory libSQL fixture DB for the attendance auto-pull/cap/back-
 * sync tests. Mirrors the CURRENT src/lib/db/schema.ts column set for every
 * table these tests touch (a stale subset fails with "table has no column
 * named…", since drizzle's insert builder references the full schema-defined
 * column set). Never touches the production database.
 */

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@/lib/db/schema';

export function makeAttendanceTestDb() {
  const client = createClient({ url: ':memory:' });
  return { client, db: drizzle(client, { schema }) };
}

export async function createAttendanceFixtureSchema(client: ReturnType<typeof createClient>) {
  await client.executeMultiple(`
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
    CREATE TABLE class_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      subject TEXT NOT NULL,
      product TEXT NOT NULL,
      batch TEXT,
      scheduled_at INTEGER NOT NULL,
      duration_minutes INTEGER NOT NULL,
      status TEXT NOT NULL,
      meet_link TEXT,
      google_event_id TEXT,
      recall_bot_id TEXT,
      instructor_id INTEGER,
      topic TEXT,
      class_number INTEGER,
      created_by INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE class_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      joined_at INTEGER NOT NULL,
      mode TEXT NOT NULL,
      source TEXT NOT NULL,
      UNIQUE(session_id, user_id)
    );
    CREATE TABLE test_windows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id INTEGER NOT NULL,
      mode TEXT NOT NULL,
      opens_at INTEGER NOT NULL,
      closes_at INTEGER NOT NULL,
      duration_minutes INTEGER,
      class_session_id INTEGER,
      status TEXT NOT NULL,
      created_by INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE test_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      window_id INTEGER NOT NULL,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      submitted_at INTEGER,
      banned_at INTEGER,
      tab_leave_count INTEGER NOT NULL,
      reset_count INTEGER NOT NULL,
      total_score REAL,
      total_correct INTEGER,
      total_wrong INTEGER,
      total_unattempted INTEGER,
      section_scores TEXT,
      chosen_sections TEXT,
      best_snapshot TEXT
    );
  `);
}

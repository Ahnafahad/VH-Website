-- Redline tables. Hand-written to match src/lib/db/schema.ts (drizzle-kit push is unsafe against prod;
-- see the db-schema-change skill's journal-desync gotcha). Idempotent. Used by scripts/import-redline.mjs
-- and by the service integration test.

CREATE TABLE IF NOT EXISTS redline_config ( id integer PRIMARY KEY NOT NULL, active integer NOT NULL DEFAULT 0, updated_at integer NOT NULL DEFAULT (unixepoch()));

CREATE TABLE IF NOT EXISTS redline_questions ( id integer PRIMARY KEY AUTOINCREMENT NOT NULL, number integer NOT NULL, source_id text NOT NULL, level integer, position integer, status text NOT NULL DEFAULT 'live', hold_reason text, skill_id text NOT NULL, secondary_skills text NOT NULL DEFAULT '[]', difficulty_label text NOT NULL, difficulty_score real NOT NULL, correct_key text NOT NULL, content text NOT NULL, staff text NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS redline_questions_number_unique ON redline_questions (number);

CREATE INDEX IF NOT EXISTS idx_redline_questions_level ON redline_questions (level, position);

CREATE INDEX IF NOT EXISTS idx_redline_questions_skill ON redline_questions (skill_id);

CREATE TABLE IF NOT EXISTS redline_attempts ( id integer PRIMARY KEY AUTOINCREMENT NOT NULL, user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE, level integer NOT NULL, attempt_no integer NOT NULL, is_first integer NOT NULL, started_at integer NOT NULL DEFAULT (unixepoch()), finished_at integer, total_correct integer NOT NULL DEFAULT 0, total_questions integer NOT NULL, total_time_ms integer NOT NULL DEFAULT 0);

CREATE UNIQUE INDEX IF NOT EXISTS redline_attempts_user_id_level_attempt_no_unique ON redline_attempts (user_id, level, attempt_no);

CREATE INDEX IF NOT EXISTS idx_redline_attempts_user ON redline_attempts (user_id);

CREATE INDEX IF NOT EXISTS idx_redline_attempts_level ON redline_attempts (level);

CREATE TABLE IF NOT EXISTS redline_responses ( id integer PRIMARY KEY AUTOINCREMENT NOT NULL, attempt_id integer NOT NULL REFERENCES redline_attempts(id) ON DELETE CASCADE, user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE, question_id integer NOT NULL REFERENCES redline_questions(id) ON DELETE CASCADE, position integer NOT NULL, is_first integer NOT NULL, selected_key text, is_correct integer NOT NULL, confidence text, first_click_ms integer NOT NULL DEFAULT 0, total_time_ms integer NOT NULL DEFAULT 0, changes text NOT NULL DEFAULT '[]', hint1_ms integer, hint2_ms integer, dwell_ms integer NOT NULL DEFAULT 0, transfer_key text, transfer_correct integer, transfer_ms integer, klass text NOT NULL, skill_id text NOT NULL, error_family text, trap_type text, created_at integer NOT NULL DEFAULT (unixepoch()));

CREATE UNIQUE INDEX IF NOT EXISTS redline_responses_attempt_id_question_id_unique ON redline_responses (attempt_id, question_id);

CREATE INDEX IF NOT EXISTS idx_redline_responses_user ON redline_responses (user_id, is_first);

CREATE INDEX IF NOT EXISTS idx_redline_responses_question ON redline_responses (question_id);

INSERT OR IGNORE INTO redline_config (id, active) VALUES (1, 0);

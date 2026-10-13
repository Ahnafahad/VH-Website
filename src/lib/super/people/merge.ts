/**
 * Account merge: move a duplicate student's data (source) onto the real account (target) and deactivate the source.
 * Table-driven raw SQL so the dry-run counts and the real run share one registry.
 *
 * keys: undefined = no unique constraint involving the user column (rows always move);
 *       []        = one row per user (conflict if the target already has any);
 *       [cols]    = UNIQUE(user, cols) (conflict if the target already has the same cols).
 * Conflicting rows are NOT moved (UPDATE OR IGNORE) - they stay on the deactivated source and are reported in the preview.
 * `parent` children (rows whose parent attempt/session must have moved with them) only move if the parent now belongs to the target.
 */
import type { Client, InStatement } from '@libsql/client';

interface MoveSpec { table: string; col?: string; keys?: string[]; parent?: { col: string; table: string } }

export const MERGE_TABLES: MoveSpec[] = [
  { table: 'user_access', keys: ['product'] },
  { table: 'last_word_sessions', keys: ['client_id'] },
  { table: 'last_word_node_mastery', keys: ['word'] },
  { table: 'last_word_edge_mastery', keys: ['edge_id'] },
  { table: 'last_word_reviews', keys: ['edge_id'] },
  { table: 'last_word_decisions' },
  { table: 'math_sessions' },
  { table: 'math_question_attempts' },
  { table: 'math_user_progress', keys: [] },
  { table: 'free_signups', keys: [] },
  { table: 'vocab_user_syllabuses', keys: ['syllabus_id'] },
  { table: 'vocab_user_progress', keys: [] },
  { table: 'vocab_user_word_records', keys: ['word_id'] },
  { table: 'vocab_confusion_pairs', keys: ['word_a_id', 'word_b_id'] },
  { table: 'vocab_flashcard_sessions', keys: ['theme_id'] },
  { table: 'vocab_quiz_sessions' },
  { table: 'vocab_quiz_answers' },
  { table: 'vocab_srs_events' },
  { table: 'vocab_user_badges', keys: ['badge_id'] },
  { table: 'vocab_weekly_leaderboard', keys: ['week_start'] },
  { table: 'vocab_hall_of_fame' },
  { table: 'vocab_upgrade_requests', keys: [] },
  { table: 'vocab_access_requests' },
  { table: 'workbook_chapter_progress', keys: ['chapter_slug'] },
  { table: 'workbook_bookmarks' },
  { table: 'workbook_mcq_attempts' },
  { table: 'vocab_game_sessions', keys: ['round_id'] },
  { table: 'vocab_game_guesses', parent: { col: 'session_id', table: 'vocab_game_sessions' } },
  { table: 'vocab_charge_rounds' },
  { table: 'analytics_sessions' },
  { table: 'analytics_events' },
  { table: 'test_attempts', keys: ['test_id'] },
  { table: 'marathon_attempts', keys: ['day_id'] },
  { table: 'class_attendance', keys: ['session_id'] },
  { table: 'recording_access_grants' },
  { table: 'recording_watch_progress', keys: ['recording_id'] },
  { table: 'material_highlights' },
  { table: 'material_drawings' },
  { table: 'assignment_submissions', keys: ['assignment_id'] },
  { table: 'class_questions' },
  { table: 'session_requests' },
  { table: 'sprint_attempts', keys: ['set_id'] },
  { table: 'redline_attempts', keys: ['level', 'attempt_no'] },
  { table: 'redline_responses', parent: { col: 'attempt_id', table: 'redline_attempts' } },
  { table: 'reading_speed_attempts' },
  { table: 'essay_submissions', keys: ['series_id', 'essay_index'] },
  { table: 'print_requests' },
];

export interface MergeRow { table: string; total: number; conflicts: number; moved: number }
export interface MergePreview { rows: MergeRow[]; registrations: number; totalMoved: number; totalConflicts: number }

const col = (s: MoveSpec) => s.col ?? 'user_id';

function conflictSql(s: MoveSpec): string | null {
  if (!s.keys) return null;
  const same = s.keys.map(k => `o.${k} = t.${k}`).join(' AND ');
  return `SELECT COUNT(*) AS n FROM ${s.table} t WHERE t.${col(s)} = ? AND EXISTS (SELECT 1 FROM ${s.table} o WHERE o.${col(s)} = ?${same ? ' AND ' + same : ''})`;
}

async function existingTables(client: Client): Promise<Set<string>> {
  const r = await client.execute("SELECT name FROM sqlite_master WHERE type = 'table'");
  return new Set(r.rows.map(x => String(x.name)));
}

const n = (v: unknown) => Number((v as { n?: unknown } | undefined)?.n ?? 0);

export async function previewMerge(client: Client, sourceId: number, targetId: number): Promise<MergePreview> {
  const have = await existingTables(client);
  const rows: MergeRow[] = [];
  for (const s of MERGE_TABLES) {
    if (!have.has(s.table)) continue;
    const total = n((await client.execute({ sql: `SELECT COUNT(*) AS n FROM ${s.table} WHERE ${col(s)} = ?`, args: [sourceId] })).rows[0]);
    if (total === 0) continue;
    const cs = conflictSql(s);
    const conflicts = cs ? n((await client.execute({ sql: cs, args: [sourceId, targetId] })).rows[0]) : 0;
    rows.push({ table: s.table, total, conflicts, moved: total - conflicts });
  }
  let registrations = 0;
  if (have.has('registrations')) {
    registrations = n((await client.execute({
      sql: 'SELECT COUNT(*) AS n FROM registrations WHERE lower(email) = (SELECT lower(email) FROM users WHERE id = ?)', args: [sourceId],
    })).rows[0]);
  }
  return {
    rows, registrations,
    totalMoved: rows.reduce((a, r) => a + r.moved, 0) + registrations,
    totalConflicts: rows.reduce((a, r) => a + r.conflicts, 0),
  };
}

interface Acct { id: number; email: string; studentId: string | null }

/** Runs the whole merge as one atomic batch. Returns the preview computed immediately beforehand. */
export async function applyMerge(client: Client, source: Acct, target: Acct): Promise<MergePreview> {
  const have = await existingTables(client);
  const preview = await previewMerge(client, source.id, target.id);
  const stmts: InStatement[] = [];

  // Carry access over: anything the source had active becomes active on the target before rows move.
  stmts.push({
    sql: 'UPDATE user_access SET active = 1 WHERE user_id = ? AND product IN (SELECT product FROM user_access WHERE user_id = ? AND active = 1)',
    args: [target.id, source.id],
  });
  for (const s of MERGE_TABLES) {
    if (!have.has(s.table)) continue;
    if (s.parent) {
      stmts.push({
        sql: `UPDATE OR IGNORE ${s.table} SET ${col(s)} = ? WHERE ${col(s)} = ? AND ${s.parent.col} IN (SELECT id FROM ${s.parent.table} WHERE user_id = ?)`,
        args: [target.id, source.id, target.id],
      });
    } else {
      stmts.push({ sql: `UPDATE OR IGNORE ${s.table} SET ${col(s)} = ? WHERE ${col(s)} = ?`, args: [target.id, source.id] });
    }
  }
  if (have.has('registrations')) {
    stmts.push({ sql: 'UPDATE registrations SET email = ? WHERE lower(email) = lower(?)', args: [target.email, source.email] });
  }
  stmts.push({ sql: 'UPDATE user_access SET active = 0 WHERE user_id = ?', args: [source.id] });
  if (source.studentId && !target.studentId) {
    stmts.push({ sql: 'UPDATE users SET student_id = NULL WHERE id = ?', args: [source.id] });
    stmts.push({ sql: 'UPDATE users SET student_id = ?, updated_at = unixepoch() WHERE id = ?', args: [source.studentId, target.id] });
  }
  stmts.push({
    sql: `UPDATE users SET status = 'inactive', sessions_invalidated_at = unixepoch(), updated_at = unixepoch(),
          notes = trim(coalesce(notes, '') || char(10) || ?) WHERE id = ?`,
    args: [`Merged into ${target.email} (#${target.id})`, source.id],
  });
  await client.batch(stmts, 'write');
  return preview;
}

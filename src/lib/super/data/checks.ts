import { db } from '@/lib/db';

type Row = Record<string, unknown>;

/** One data check = one object. `sql` is a read-only SELECT; count and the 20-row sample are derived from it. */
export interface DataCheck {
  id: string;
  title: string;
  description: string;
  severity: 'high' | 'warn' | 'info';
  sql: string;
  href?: (row: Row) => string | null;
}

const student = (r: Row) => (r.user_id ?? r.id) != null ? `/admin/students/${r.user_id ?? r.id}` : null;

export const DATA_CHECKS: DataCheck[] = [
  {
    id: 'orphan-test-answers', severity: 'high', title: 'Orphan test answers',
    description: 'test_answers whose attempt or question no longer exists',
    sql: `SELECT a.id, a.attempt_id, a.question_id FROM test_answers a
          WHERE NOT EXISTS (SELECT 1 FROM test_attempts t WHERE t.id = a.attempt_id)
             OR NOT EXISTS (SELECT 1 FROM test_questions q WHERE q.id = a.question_id)`,
  },
  {
    id: 'orphan-test-attempts', severity: 'high', title: 'Orphan test attempts',
    description: 'test_attempts pointing at a missing user, test or window',
    sql: `SELECT a.id, a.user_id, a.test_id, a.window_id FROM test_attempts a
          WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = a.user_id)
             OR NOT EXISTS (SELECT 1 FROM tests t WHERE t.id = a.test_id)
             OR NOT EXISTS (SELECT 1 FROM test_windows w WHERE w.id = a.window_id)`,
  },
  {
    id: 'orphan-user-access', severity: 'high', title: 'Orphan access grants',
    description: 'user_access rows whose user is gone',
    sql: `SELECT ua.id, ua.user_id, ua.product FROM user_access ua WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ua.user_id)`,
  },
  {
    id: 'orphan-attendance', severity: 'high', title: 'Orphan attendance rows',
    description: 'class_attendance pointing at a missing session or user',
    sql: `SELECT c.id, c.session_id, c.user_id FROM class_attendance c
          WHERE NOT EXISTS (SELECT 1 FROM class_sessions s WHERE s.id = c.session_id)
             OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = c.user_id)`,
  },
  {
    id: 'orphan-recording-grants', severity: 'warn', title: 'Orphan recording grants',
    description: 'recording_access_grants whose recording or user is gone',
    sql: `SELECT g.id, g.recording_id, g.user_id FROM recording_access_grants g
          WHERE NOT EXISTS (SELECT 1 FROM recordings r WHERE r.id = g.recording_id)
             OR (g.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = g.user_id))`,
  },
  {
    id: 'dup-email', severity: 'high', title: 'Duplicate students by email',
    description: 'Users sharing the same trimmed, lower-cased email',
    sql: `SELECT lower(trim(email)) AS email, count(*) AS n, group_concat(id) AS ids FROM users GROUP BY lower(trim(email)) HAVING count(*) > 1`,
  },
  {
    id: 'dup-phone', severity: 'warn', title: 'Duplicate students by phone',
    description: 'Users sharing the same WhatsApp number (digits only, last 10)',
    sql: `SELECT substr(replace(replace(replace(replace(whatsapp,' ',''),'-',''),'+',''),'(',''), -10) AS phone, count(*) AS n, group_concat(id) AS ids
          FROM users WHERE whatsapp IS NOT NULL AND length(trim(whatsapp)) >= 10
          GROUP BY phone HAVING count(*) > 1`,
  },
  {
    id: 'dup-name-batch', severity: 'info', title: 'Same name within a batch',
    description: 'Students with the same normalized name in the same batch (may be genuine)',
    sql: `SELECT lower(trim(name)) AS name, batch, count(*) AS n, group_concat(id) AS ids FROM users
          WHERE role = 'student' AND batch IS NOT NULL GROUP BY lower(trim(name)), batch HAVING count(*) > 1`,
  },
  {
    id: 'student-no-access', severity: 'warn', title: 'Active students with no active access',
    description: 'role=student, status=active, but no active user_access row',
    sql: `SELECT u.id AS user_id, u.name, u.email, u.batch FROM users u
          WHERE u.role = 'student' AND u.status = 'active'
            AND NOT EXISTS (SELECT 1 FROM user_access ua WHERE ua.user_id = u.id AND ua.active = 1)`,
    href: student,
  },
  {
    id: 'student-no-id', severity: 'warn', title: 'Active students missing a student ID',
    description: 'student_id is null although other students in the same batch have one',
    sql: `SELECT u.id AS user_id, u.name, u.email, u.batch FROM users u
          WHERE u.role = 'student' AND u.status = 'active' AND u.student_id IS NULL AND u.batch IS NOT NULL
            AND EXISTS (SELECT 1 FROM users o WHERE o.batch = u.batch AND o.student_id IS NOT NULL)`,
    href: student,
  },
  {
    id: 'instructor-no-classes', severity: 'info', title: 'Instructors with no classes',
    description: "role='instructor' but never assigned to a class session",
    sql: `SELECT u.id AS user_id, u.name, u.email FROM users u
          WHERE u.role = 'instructor' AND NOT EXISTS (SELECT 1 FROM class_sessions s WHERE s.instructor_id = u.id)`,
    href: student,
  },
  {
    id: 'enrolled-no-user', severity: 'warn', title: 'Enrolled registrations without a user',
    description: "registrations with status 'enrolled' whose email matches no user",
    sql: `SELECT r.id, r.name, r.email, r.status FROM registrations r
          WHERE r.status = 'enrolled' AND NOT EXISTS (SELECT 1 FROM users u WHERE lower(trim(u.email)) = lower(trim(r.email)))`,
    href: () => '/admin/registrations',
  },
  {
    id: 'inactive-active-access', severity: 'warn', title: 'Inactive users with active access',
    description: 'status is not active, yet an active user_access row remains',
    sql: `SELECT u.id AS user_id, u.name, u.email, u.status FROM users u
          WHERE u.status <> 'active' AND EXISTS (SELECT 1 FROM user_access ua WHERE ua.user_id = u.id AND ua.active = 1)`,
    href: student,
  },
  {
    id: 'expired-recording-grants', severity: 'info', title: 'Expired recording grants',
    description: 'recording_access_grants past expires_at (safe to purge)',
    sql: `SELECT g.id, g.recording_id, g.user_id, datetime(g.expires_at, 'unixepoch') AS expired_at FROM recording_access_grants g WHERE g.expires_at < unixepoch()`,
  },
  {
    id: 'stale-attempts', severity: 'warn', title: 'Stuck in-progress test attempts',
    description: 'in_progress attempts older than 2 days',
    sql: `SELECT a.id, a.user_id, a.test_id, datetime(a.started_at, 'unixepoch') AS started FROM test_attempts a
          WHERE a.status = 'in_progress' AND a.started_at < unixepoch() - 172800`,
    href: r => (r.test_id != null ? `/admin/tests/${r.test_id}` : null),
  },
];

export interface CheckResult {
  id: string; title: string; description: string; severity: DataCheck['severity'];
  count: number; columns: string[]; sample: (string | number | null)[][]; links: (string | null)[]; error?: string;
}

/** Runs every check (count + 20-row sample) in one read batch. A failing check is reported, not fatal. */
export async function runDataChecks(only?: string): Promise<CheckResult[]> {
  const checks = only ? DATA_CHECKS.filter(c => c.id === only) : DATA_CHECKS;
  const stmts = checks.flatMap(c => [`SELECT count(*) AS n FROM (${c.sql})`, `${c.sql} LIMIT 20`]);
  const results: CheckResult[] = [];
  try {
    const rs = await db.$client.batch(stmts, 'read');
    checks.forEach((c, i) => {
      const cnt = rs[i * 2], smp = rs[i * 2 + 1];
      const rows = smp.rows.map(r => smp.columns.map((_, k) => (r[k] instanceof Uint8Array ? '[blob]' : (r[k] as string | number | null | bigint)) as string | number | null));
      results.push({
        id: c.id, title: c.title, description: c.description, severity: c.severity,
        count: Number(cnt.rows[0]?.n ?? 0), columns: smp.columns, sample: rows.map(r => r.map(v => (typeof v === 'bigint' ? Number(v) : v))),
        links: smp.rows.map(r => c.href?.(Object.fromEntries(smp.columns.map((k, j) => [k, r[j]]))) ?? null),
      });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // One bad statement fails the whole batch: retry per check so the rest still report.
    if (only) results.push({ id: checks[0].id, title: checks[0].title, description: checks[0].description, severity: checks[0].severity, count: 0, columns: [], sample: [], links: [], error: msg });
    else for (const c of checks) results.push(...(await runDataChecks(c.id)));
  }
  return results;
}

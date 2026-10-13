/**
 * Effective attendance semantics (pure, no DB).
 *
 * Only completed, past classes are ever counted (callers filter that). Rule:
 * a student is ABSENT only when an explicit "absent" row exists. Anyone not
 * marked is PRESENT. One exception protects old history: before the Absent
 * button existed, staff only stored rows for students who attended, so a
 * class that has attendance rows but no attendance_taken_at is an old "taken"
 * class where a missing row really meant absent. We keep that meaning.
 *
 *   attendance_taken_at set          -> no row = present, absent row = absent
 *   no taken_at, has some row(s)     -> legacy: no row = absent
 *   no taken_at, no rows at all      -> never marked: everyone present
 *
 * Callers pass `sessionsWithRows` (ids of sessions with at least one
 * attendance row of any status), computed with one grouped query.
 */

export type StaffAttendanceState = 'unmarked' | 'present' | 'absent';

export interface AttendanceRowLite { sessionId: number; mode: string; status: string }
export interface SessionTakenLite { id: number; attendanceTakenAt: Date | null }

/** Is this student effectively present, given the session and their row (if any)? */
export function isEffectivelyPresent(
  attendanceTakenAt: Date | null | undefined,
  row: { status: string } | undefined | null,
  sessionHasRows: boolean,
): boolean {
  if (row) return row.status !== 'absent';
  if (attendanceTakenAt != null) return true;
  return !sessionHasRows; // legacy taken class (rows only) => absent; never marked => present
}

/** What staff see: no row = Not marked; an explicit absent row = Absent. */
export function staffStateFromRow(row: { status: string } | undefined | null): StaffAttendanceState {
  if (!row) return 'unmarked';
  return row.status === 'absent' ? 'absent' : 'present';
}

/**
 * One student's effective attendance: sessionId -> mode ('online' | 'offline')
 * for every session they are effectively present at. Implicit presence
 * (no row) counts as 'offline'.
 */
export function effectiveAttendanceMap(
  sessions: SessionTakenLite[],
  rows: AttendanceRowLite[],
  sessionsWithRows: ReadonlySet<number>,
): Map<number, string> {
  const bySession = new Map(rows.map(r => [r.sessionId, r]));
  const out = new Map<number, string>();
  for (const s of sessions) {
    const row = bySession.get(s.id);
    if (!isEffectivelyPresent(s.attendanceTakenAt, row, sessionsWithRows.has(s.id))) continue;
    out.set(s.id, row && row.status !== 'absent' ? row.mode : 'offline');
  }
  return out;
}

export interface AttendanceRecordInput {
  userId: number;
  state?: StaffAttendanceState;
  /** Legacy input: true = present, false = absent-by-deletion (now "unmarked"). */
  present?: boolean;
  mode?: 'online' | 'offline';
}

export type AttendanceWrite =
  | { userId: number; action: 'delete' }
  | { userId: number; action: 'upsert'; status: 'present' | 'absent'; mode: 'online' | 'offline' };

/**
 * Turns a PUT record into a DB action. Legacy `present:false` keeps its old
 * meaning (row removed). Absent always stores mode 'offline'.
 */
export function resolveAttendanceWrite(rec: AttendanceRecordInput): AttendanceWrite {
  const state: StaffAttendanceState = rec.state ?? (rec.present ? 'present' : 'unmarked');
  if (state === 'unmarked') return { userId: rec.userId, action: 'delete' };
  if (state === 'absent') return { userId: rec.userId, action: 'upsert', status: 'absent', mode: 'offline' };
  return { userId: rec.userId, action: 'upsert', status: 'present', mode: rec.mode === 'online' ? 'online' : 'offline' };
}

/** Inferred (test pull / back-sync) writes must never overwrite an explicit absent row. */
export function inferredWriteBlocked(existing: { status: string } | undefined | null): boolean {
  return existing?.status === 'absent';
}

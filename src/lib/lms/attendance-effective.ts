/**
 * Effective attendance semantics (pure, no DB).
 *
 * Staff mark a student Present, Absent or leave them Not marked. Once a class
 * has had attendance taken (class_sessions.attendance_taken_at is set), a
 * student with NO row counts as PRESENT until explicitly marked absent. Sessions
 * where attendance was never taken (all legacy history, untaken classes) keep
 * the legacy rule exactly: row = present, no row = absent.
 */

export type StaffAttendanceState = 'unmarked' | 'present' | 'absent';

export interface AttendanceRowLite { sessionId: number; mode: string; status: string }
export interface SessionTakenLite { id: number; attendanceTakenAt: Date | null }

/** Is this student effectively present, given the session and their row (if any)? */
export function isEffectivelyPresent(
  attendanceTakenAt: Date | null | undefined,
  row: { status: string } | undefined | null,
): boolean {
  if (row) return row.status !== 'absent';
  return attendanceTakenAt != null;
}

/** What staff see: no row = Not marked; an explicit absent row = Absent. */
export function staffStateFromRow(row: { status: string } | undefined | null): StaffAttendanceState {
  if (!row) return 'unmarked';
  return row.status === 'absent' ? 'absent' : 'present';
}

/**
 * One student's effective attendance: sessionId -> mode ('online' | 'offline')
 * for every session they are effectively present at. Implicit presence
 * (taken session, no row) counts as 'offline'.
 */
export function effectiveAttendanceMap(
  sessions: SessionTakenLite[],
  rows: AttendanceRowLite[],
): Map<number, string> {
  const bySession = new Map(rows.map(r => [r.sessionId, r]));
  const out = new Map<number, string>();
  for (const s of sessions) {
    const row = bySession.get(s.id);
    if (!isEffectivelyPresent(s.attendanceTakenAt, row)) continue;
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

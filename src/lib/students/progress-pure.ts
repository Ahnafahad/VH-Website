/**
 * Pure helpers for the Students Progress page. No DB imports, so they are
 * unit-testable without a database. The DB layer is progress.ts; the UI is
 * src/components/admin/students/StudentsProgressClient.tsx.
 */

import type { AttendanceTick, HomeworkState, StudentSummary } from './progress-types';

export const RECENT_CLASSES = 8;
export const RECENT_HOMEWORK = 6;
export const RECENT_MARKS = 6;

// ─── Data shaping (used by progress.ts) ───────────────────────────────────────

/**
 * Last `n` classes, oldest first. `attended` maps sessionId -> attendance mode
 * ('online' | 'offline'); a session missing from the map is an absence.
 */
export function buildAttendanceTicks(
  sessions: { id: number; scheduledAt: Date }[],
  attended: Map<number, string>,
  n: number = RECENT_CLASSES,
): AttendanceTick[] {
  return [...sessions]
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime() || a.id - b.id)
    .slice(-n)
    .map(s => {
      const mode = attended.get(s.id);
      if (mode === undefined) return 'absent';
      return mode === 'online' ? 'online' : 'present';
    });
}

/**
 * Last `n` past-due homeworks, oldest due date first. `submissions` maps
 * assignmentId -> submission status ('submitted' | 'reviewed'); no entry = missing.
 */
export function buildHomeworkStates(
  assignments: { id: number; dueAt: Date }[],
  submissions: Map<number, string>,
  n: number = RECENT_HOMEWORK,
): HomeworkState[] {
  return [...assignments]
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime() || a.id - b.id)
    .slice(-n)
    .map(a => {
      const status = submissions.get(a.id);
      if (status === undefined) return 'missing';
      return status === 'reviewed' ? 'reviewed' : 'waiting';
    });
}

/** Last `n` percentages (given oldest first), rounded to whole numbers. */
export function lastMarks(percentages: number[], n: number = RECENT_MARKS): number[] {
  return percentages.slice(-n).map(p => Math.round(p));
}

// ─── Labels for assistive tech ────────────────────────────────────────────────

export function describeTicks(ticks: AttendanceTick[]): string {
  if (ticks.length === 0) return 'No classes yet';
  const c = { present: 0, online: 0, absent: 0 };
  for (const t of ticks) c[t] += 1;
  return `Last ${ticks.length} classes: ${c.present} present, ${c.online} online, ${c.absent} absent`;
}

export function describeHomework(states: HomeworkState[]): string {
  if (states.length === 0) return 'No homework due yet';
  const c = { reviewed: 0, waiting: 0, missing: 0 };
  for (const s of states) c[s] += 1;
  return `Last ${states.length} homeworks: ${c.reviewed} reviewed, ${c.waiting} waiting for review, ${c.missing} missing`;
}

// ─── Search / filter / sort (used by the client) ──────────────────────────────

export type SortKey = 'name' | 'attendance' | 'avg';
export type SortDir = 'asc' | 'desc';

export interface ViewOptions {
  query:    string;
  onlyRisk: boolean;
  riskIds:  ReadonlySet<number>;
  sortKey:  SortKey;
  dir:      SortDir;
}

/** Case-insensitive match on name or email. An empty query matches everyone. */
export function matchesQuery(s: Pick<StudentSummary, 'name' | 'email'>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
}

/**
 * Filters then sorts. Students with no value for a numeric column (null)
 * always sort last, whichever direction is chosen.
 */
export function filterAndSortStudents(students: StudentSummary[], opts: ViewOptions): StudentSummary[] {
  const sign = opts.dir === 'asc' ? 1 : -1;
  const rows = students.filter(s => matchesQuery(s, opts.query) && (!opts.onlyRisk || opts.riskIds.has(s.id)));
  return rows.sort((a, b) => {
    if (opts.sortKey === 'name') return sign * a.name.localeCompare(b.name);
    const av = opts.sortKey === 'attendance' ? a.attendancePercent : a.avgTestPercentage;
    const bv = opts.sortKey === 'attendance' ? b.attendancePercent : b.avgTestPercentage;
    if (av == null && bv == null) return a.name.localeCompare(b.name);
    if (av == null) return 1;
    if (bv == null) return -1;
    return sign * (av - bv) || a.name.localeCompare(b.name);
  });
}

// ─── Cohort map ───────────────────────────────────────────────────────────────

export interface MapDomain { lo: number; hi: number; ticks: number[] }

/** Y-axis range for the average mark, padded and snapped to tens, at least 20 wide. */
export function computeMarkDomain(values: number[]): MapDomain {
  if (values.length === 0) return { lo: 0, hi: 100, ticks: [0, 50, 100] };
  let lo = Math.max(0, Math.floor((Math.min(...values) - 5) / 10) * 10);
  let hi = Math.min(100, Math.ceil((Math.max(...values) + 5) / 10) * 10);
  if (hi - lo < 20) {
    hi = Math.min(100, lo + 20);
    lo = Math.max(0, hi - 20);
  }
  return { lo, hi, ticks: [lo, Math.round((lo + hi) / 2), hi] };
}

/** Position of a student in the map, as 0-100 percentages from the left and bottom. */
export function mapPosition(attendance: number, avg: number, domain: MapDomain): { x: number; y: number } {
  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  return {
    x: clamp(attendance),
    y: clamp(((avg - domain.lo) / (domain.hi - domain.lo)) * 100),
  };
}

export interface MapPoint {
  student: StudentSummary;
  x: number;
  y: number;
}

/** Students that have both numbers can be plotted; the rest are counted separately. */
export function buildMapPoints(students: StudentSummary[], domain: MapDomain): { points: MapPoint[]; unplotted: number } {
  const points: MapPoint[] = [];
  let unplotted = 0;
  for (const s of students) {
    if (s.attendancePercent == null || s.avgTestPercentage == null) { unplotted += 1; continue; }
    points.push({ student: s, ...mapPosition(s.attendancePercent, s.avgTestPercentage, domain) });
  }
  return { points, unplotted };
}

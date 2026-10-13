/**
 * Pure logic for the Today cockpit (clock phase, recorder strip status,
 * attendance tap-cycle, material input checks). No React, no DB — everything
 * here is unit-tested in __tests__/today-cockpit.test.ts.
 */

import { HTML_FILE_NAME_RE, HTML_MATERIAL_MAX_BYTES } from '@/lib/lms/html-material';

// ─── Clock phase ──────────────────────────────────────────────────────────────

export type ClockPhase = 'before' | 'live' | 'after' | 'cancelled';

export interface ClockSession {
  scheduledAt: number; // epoch ms
  durationMinutes: number;
  status: string;
}

export function deriveClockPhase(s: ClockSession, now: number): ClockPhase {
  if (s.status === 'cancelled') return 'cancelled';
  if (s.status === 'completed') return 'after';
  if (s.status === 'live') return 'live';
  const end = s.scheduledAt + s.durationMinutes * 60_000;
  if (now < s.scheduledAt) return 'before';
  if (now < end) return 'live';
  return 'after';
}

export function formatSpan(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60_000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Human line for the header chip: "Starts in 40 min", "Live · 42 min left", "Ended 12 min ago". */
export function phaseLabel(s: ClockSession, now: number): string {
  const phase = deriveClockPhase(s, now);
  const end = s.scheduledAt + s.durationMinutes * 60_000;
  switch (phase) {
    case 'cancelled': return 'Cancelled';
    case 'before': return `Starts in ${formatSpan(s.scheduledAt - now)}`;
    case 'live': return now < end ? `Live · ${formatSpan(end - now)} left` : 'Live · past scheduled end';
    case 'after':
      if (s.status === 'completed') return 'Completed';
      return now >= end ? `Ended ${formatSpan(now - end)} ago` : 'Ended';
  }
}

export type SectionId = 'materials' | 'homework' | 'attendance' | 'wrapup';

export function defaultOpenSection(phase: ClockPhase): SectionId | null {
  switch (phase) {
    case 'before': return 'materials';
    case 'live': return 'attendance';
    case 'after': return 'wrapup';
    case 'cancelled': return null;
  }
}

/** The class the cockpit shows: live one, else next upcoming, else the most recent. */
export function pickActiveSessionId(sessions: (ClockSession & { id: number })[], now: number): number | null {
  if (sessions.length === 0) return null;
  const sorted = [...sessions].sort((a, b) => a.scheduledAt - b.scheduledAt);
  const withPhase = sorted.map(s => ({ s, phase: deriveClockPhase(s, now) }));
  const live = withPhase.find(x => x.phase === 'live');
  if (live) return live.s.id;
  const upcoming = withPhase.find(x => x.phase === 'before');
  if (upcoming) return upcoming.s.id;
  const ended = withPhase.filter(x => x.phase === 'after');
  if (ended.length > 0) return ended[ended.length - 1].s.id;
  return sorted[0].id;
}

// ─── Recorder strip ───────────────────────────────────────────────────────────

export type BotKind = 'joining' | 'waiting' | 'in_meeting' | 'recording' | 'processing' | 'failed';

/**
 * Map a raw provider status string (Skribby webhook `new_status`) to a coarse
 * kind. Unknown strings return null so callers fall back to "scheduled".
 */
export function classifyBotStatus(raw: string | null | undefined): BotKind | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (['not_admitted', 'bot_detected', 'auth_required', 'invalid_credentials', 'failed'].includes(s)) return 'failed';
  if (s.includes('record')) return 'recording';
  if (s.includes('wait') || s.includes('lobby')) return 'waiting';
  if (s === 'finished' || s.includes('process') || s.includes('transcrib')) return 'processing';
  if (s.includes('call') || s.includes('meeting') || s.includes('joined')) return 'in_meeting';
  if (s.includes('join') || s.includes('boot') || s.includes('start') || s.includes('connect')) return 'joining';
  return null;
}

export interface RecorderRecording {
  status: string; // pending | processing | available | failed | expired
  errorMessage: string | null;
  durationSeconds: number | null;
  botStatus: string | null;
  botStatusAt: number | null;
  botJoinedAt: number | null;
  botRecordingAt: number | null;
}

export interface RecorderInput {
  meetLink: string | null;
  recallBotId: string | null;
  scheduledAt: number;
  recording: RecorderRecording | null;
}

export type RecorderKind =
  | 'no_link' | 'no_bot' | 'scheduled' | 'joining' | 'waiting' | 'in_meeting'
  | 'recording' | 'processing' | 'ready' | 'failed' | 'expired';

export type RecorderTone = 'ok' | 'warn' | 'bad' | 'info' | 'muted';

export interface RecorderView {
  kind: RecorderKind;
  label: string;
  tone: RecorderTone;
  /** Where/when line prefix, paired with `at` (epoch ms), e.g. "Recording since". */
  atLabel: string | null;
  at: number | null;
  reason: string | null;
  canSend: boolean;
  canRetry: boolean;
}

export function deriveRecorder(i: RecorderInput): RecorderView {
  const base = { atLabel: null, at: null, reason: null, canSend: false, canRetry: false };
  const rec = i.recording;

  if (!i.meetLink) {
    return { ...base, kind: 'no_link', label: 'No meeting link', tone: 'muted', reason: 'Add a meeting link, then send the bot.' };
  }
  if (rec?.status === 'available') {
    return {
      ...base, kind: 'ready', label: 'Recording ready', tone: 'ok',
      reason: rec.durationSeconds ? `${Math.round(rec.durationSeconds / 60)} min` : null,
    };
  }
  if (rec?.status === 'expired') {
    return { ...base, kind: 'expired', label: 'Recording expired', tone: 'muted' };
  }
  if (rec?.status === 'failed') {
    return {
      ...base, kind: 'failed', label: 'Bot failed', tone: 'bad', canRetry: true,
      reason: rec.errorMessage ?? 'The recorder reported a failure.',
      atLabel: rec.botStatusAt ? 'At' : null, at: rec.botStatusAt,
    };
  }
  if (rec?.status === 'processing') {
    return {
      ...base, kind: 'processing', label: 'Processing', tone: 'info',
      reason: 'Usually ready about 20 minutes after class.',
      atLabel: rec.botStatusAt ? 'Since' : null, at: rec.botStatusAt,
    };
  }
  if (!i.recallBotId) {
    return { ...base, kind: 'no_bot', label: 'Bot not sent', tone: 'warn', canSend: true, reason: 'No recording bot is scheduled for this class.' };
  }

  const kind = classifyBotStatus(rec?.botStatus);
  switch (kind) {
    case 'recording':
      return { ...base, kind: 'recording', label: 'Recording', tone: 'ok', atLabel: 'Recording since', at: rec?.botRecordingAt ?? rec?.botStatusAt ?? null };
    case 'in_meeting':
      return { ...base, kind: 'in_meeting', label: 'In the meeting', tone: 'ok', atLabel: 'Joined', at: rec?.botJoinedAt ?? rec?.botStatusAt ?? null };
    case 'waiting':
      return { ...base, kind: 'waiting', label: 'In waiting room', tone: 'warn', canRetry: true, reason: 'Admit the bot from the meeting.', atLabel: 'Since', at: rec?.botStatusAt ?? null };
    case 'joining':
      return { ...base, kind: 'joining', label: 'Joining', tone: 'info', canRetry: true, atLabel: 'Since', at: rec?.botStatusAt ?? null };
    case 'processing':
      return { ...base, kind: 'processing', label: 'Processing', tone: 'info', reason: 'Usually ready about 20 minutes after class.', atLabel: 'Since', at: rec?.botStatusAt ?? null };
    case 'failed':
      return { ...base, kind: 'failed', label: 'Bot failed', tone: 'bad', canRetry: true, reason: rec?.errorMessage ?? rec?.botStatus ?? null };
    default:
      return { ...base, kind: 'scheduled', label: 'Bot scheduled', tone: 'info', canRetry: true, atLabel: 'Joins at', at: i.scheduledAt };
  }
}

/** Keep refetching the recorder while something can still change. */
export function shouldPollRecorder(phase: ClockPhase, kind: RecorderKind): boolean {
  if (phase === 'cancelled') return false;
  if (phase === 'live') return kind !== 'ready' && kind !== 'expired' && kind !== 'no_link';
  if (phase === 'after') return kind === 'recording' || kind === 'processing' || kind === 'in_meeting' || kind === 'joining';
  return false;
}

export interface MeetingPlatform { name: string; host: string }

export function meetingPlatform(url: string | null | undefined): MeetingPlatform | null {
  if (!url) return null;
  let host: string;
  try { host = new URL(url).host; } catch { return null; }
  const h = host.toLowerCase();
  if (h.includes('meet.google')) return { name: 'Google Meet', host };
  if (h.includes('zoom.us')) return { name: 'Zoom', host };
  if (h.includes('teams.microsoft') || h.includes('teams.live')) return { name: 'Microsoft Teams', host };
  return { name: host, host };
}

// ─── Attendance ───────────────────────────────────────────────────────────────

export type AttendanceState = 'none' | 'present' | 'online' | 'absent';

/** Roster endpoint value (unmarked | present | absent) + mode -> cockpit tap state. */
export function attendanceFromRoster(r: { state: 'unmarked' | 'present' | 'absent'; mode: 'online' | 'offline' }): AttendanceState {
  if (r.state === 'unmarked') return 'none';
  if (r.state === 'absent') return 'absent';
  return r.mode === 'online' ? 'online' : 'present';
}

/** Cockpit tap state -> record sent to the attendance PUT. 'none' (Not marked) removes the row. */
export function attendanceRecord(state: AttendanceState): { state: 'unmarked' | 'present' | 'absent'; mode: 'online' | 'offline' } {
  if (state === 'none') return { state: 'unmarked', mode: 'offline' };
  if (state === 'absent') return { state: 'absent', mode: 'offline' };
  return { state: 'present', mode: state === 'online' ? 'online' : 'offline' };
}

/**
 * Tap order: not marked -> present -> online -> absent -> not marked ...
 * Online is skipped when the student is at the online cap and was not already
 * online for this class (same hard block as the old attendance sheet).
 */
export function cycleAttendance(cur: AttendanceState, onlineBlocked: boolean): AttendanceState {
  switch (cur) {
    case 'none': return 'present';
    case 'present': return onlineBlocked ? 'absent' : 'online';
    case 'online': return 'absent';
    case 'absent': return 'none';
  }
}

export function attendanceCounts(states: AttendanceState[]) {
  const c = { present: 0, online: 0, absent: 0, none: 0 };
  for (const s of states) c[s] += 1;
  return { ...c, here: c.present + c.online, total: states.length };
}

// ─── Material input ───────────────────────────────────────────────────────────

export type MaterialFileKind = 'pdf' | 'html';

export function classifyMaterialFile(f: { name: string; type: string; size: number }):
  { ok: true; kind: MaterialFileKind } | { ok: false; error: string } {
  const isHtml = f.type === 'text/html' || HTML_FILE_NAME_RE.test(f.name);
  if (isHtml) {
    if (f.size > HTML_MATERIAL_MAX_BYTES) return { ok: false, error: 'HTML files must be under 10 MB' };
    return { ok: true, kind: 'html' };
  }
  if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) return { ok: true, kind: 'pdf' };
  return { ok: false, error: 'Only PDF or HTML files can be uploaded. Paste a link for anything else.' };
}

/** Returns the normalised http(s) URL, or null when it is not one. */
export function normaliseMaterialLink(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export function titleFromFileName(name: string): string {
  return name.replace(/\.(pdf|html?)$/i, '').replace(/[-_]+/g, ' ').trim();
}

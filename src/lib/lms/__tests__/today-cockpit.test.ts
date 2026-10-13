import { describe, it, expect } from 'vitest';
import {
  deriveClockPhase, phaseLabel, pickActiveSessionId, classifyBotStatus, deriveRecorder,
  shouldPollRecorder, cycleAttendance, attendanceFromRoster, attendanceCounts, attendanceRecord, classifyMaterialFile,
  normaliseMaterialLink, meetingPlatform, defaultOpenSection,
} from '../today-cockpit';

const T0 = Date.parse('2026-10-13T09:00:00Z');
const min = (n: number) => n * 60_000;
const cls = (over = {}) => ({ scheduledAt: T0, durationMinutes: 90, status: 'scheduled', ...over });

describe('clock phase', () => {
  it('before / live / after by time', () => {
    expect(deriveClockPhase(cls(), T0 - min(1))).toBe('before');
    expect(deriveClockPhase(cls(), T0)).toBe('live');
    expect(deriveClockPhase(cls(), T0 + min(89))).toBe('live');
    expect(deriveClockPhase(cls(), T0 + min(90))).toBe('after');
  });
  it('status overrides time', () => {
    expect(deriveClockPhase(cls({ status: 'cancelled' }), T0 + min(10))).toBe('cancelled');
    expect(deriveClockPhase(cls({ status: 'completed' }), T0 - min(10))).toBe('after');
    expect(deriveClockPhase(cls({ status: 'live' }), T0 - min(10))).toBe('live');
  });
  it('labels', () => {
    expect(phaseLabel(cls(), T0 - min(40))).toBe('Starts in 40 min');
    expect(phaseLabel(cls(), T0 + min(48))).toBe('Live · 42 min left');
    expect(phaseLabel(cls(), T0 + min(102))).toBe('Ended 12 min ago');
    expect(phaseLabel(cls({ status: 'completed' }), T0 + min(200))).toBe('Completed');
  });
  it('default open section follows the clock', () => {
    expect(defaultOpenSection('before')).toBe('materials');
    expect(defaultOpenSection('live')).toBe('attendance');
    expect(defaultOpenSection('after')).toBe('wrapup');
    expect(defaultOpenSection('cancelled')).toBeNull();
  });
  it('picks live, else next, else latest ended', () => {
    const a = { id: 1, ...cls({ scheduledAt: T0 - min(300) }) };
    const b = { id: 2, ...cls() };
    const c = { id: 3, ...cls({ scheduledAt: T0 + min(300) }) };
    expect(pickActiveSessionId([a, b, c], T0 + min(10))).toBe(2);
    expect(pickActiveSessionId([a, b, c], T0 + min(120))).toBe(3);
    expect(pickActiveSessionId([a, b], T0 + min(120))).toBe(2);
    expect(pickActiveSessionId([], T0)).toBeNull();
  });
});

describe('recorder status', () => {
  const rec = (over = {}) => ({
    status: 'pending', errorMessage: null, durationSeconds: null,
    botStatus: null, botStatusAt: null, botJoinedAt: null, botRecordingAt: null, ...over,
  });
  const base = { meetLink: 'https://meet.google.com/abc', recallBotId: 'bot1', scheduledAt: T0 };

  it('classifies provider strings', () => {
    expect(classifyBotStatus('recording')).toBe('recording');
    expect(classifyBotStatus('in_waiting_room')).toBe('waiting');
    expect(classifyBotStatus('not_admitted')).toBe('failed');
    expect(classifyBotStatus('finished')).toBe('processing');
    expect(classifyBotStatus('joining')).toBe('joining');
    expect(classifyBotStatus('???')).toBeNull();
    expect(classifyBotStatus(null)).toBeNull();
  });
  it('no link / no bot', () => {
    expect(deriveRecorder({ ...base, meetLink: null, recording: null }).kind).toBe('no_link');
    const v = deriveRecorder({ ...base, recallBotId: null, recording: null });
    expect(v.kind).toBe('no_bot');
    expect(v.canSend).toBe(true);
  });
  it('scheduled shows join time and allows retry', () => {
    const v = deriveRecorder({ ...base, recording: rec() });
    expect(v).toMatchObject({ kind: 'scheduled', at: T0, canRetry: true });
  });
  it('recording shows since time and cannot retry', () => {
    const v = deriveRecorder({ ...base, recording: rec({ botStatus: 'recording', botRecordingAt: T0 + 5 }) });
    expect(v).toMatchObject({ kind: 'recording', at: T0 + 5, canRetry: false });
  });
  it('failed carries the reason; ready and processing map from recording status', () => {
    expect(deriveRecorder({ ...base, recording: rec({ status: 'failed', errorMessage: 'not_admitted' }) }))
      .toMatchObject({ kind: 'failed', reason: 'not_admitted', canRetry: true });
    expect(deriveRecorder({ ...base, recording: rec({ status: 'available', durationSeconds: 5400 }) }))
      .toMatchObject({ kind: 'ready', reason: '90 min' });
    expect(deriveRecorder({ ...base, recording: rec({ status: 'processing' }) }).kind).toBe('processing');
  });
  it('polls only while something can still change', () => {
    expect(shouldPollRecorder('live', 'recording')).toBe(true);
    expect(shouldPollRecorder('live', 'ready')).toBe(false);
    expect(shouldPollRecorder('before', 'scheduled')).toBe(false);
    expect(shouldPollRecorder('after', 'processing')).toBe(true);
    expect(shouldPollRecorder('after', 'failed')).toBe(false);
    expect(shouldPollRecorder('cancelled', 'recording')).toBe(false);
  });
  it('platform from link', () => {
    expect(meetingPlatform('https://meet.google.com/abc-defg')?.name).toBe('Google Meet');
    expect(meetingPlatform('https://us02web.zoom.us/j/1')?.name).toBe('Zoom');
    expect(meetingPlatform('nope')).toBeNull();
  });
});

describe('attendance cycle', () => {
  it('none -> present -> online -> absent -> none', () => {
    expect(cycleAttendance('none', false)).toBe('present');
    expect(cycleAttendance('present', false)).toBe('online');
    expect(cycleAttendance('online', false)).toBe('absent');
    expect(cycleAttendance('absent', false)).toBe('none');
  });
  it('skips online at the cap', () => {
    expect(cycleAttendance('present', true)).toBe('absent');
  });
  it('maps to server records and counts', () => {
    expect(attendanceRecord('online')).toEqual({ state: 'present', mode: 'online' });
    expect(attendanceRecord('present')).toEqual({ state: 'present', mode: 'offline' });
    expect(attendanceRecord('absent').state).toBe('absent');
    expect(attendanceRecord('none').state).toBe('unmarked');
    expect(attendanceFromRoster({ state: 'absent', mode: 'offline' })).toBe('absent');
    expect(attendanceFromRoster({ state: 'unmarked', mode: 'offline' })).toBe('none');
    expect(attendanceFromRoster({ state: 'present', mode: 'online' })).toBe('online');
    expect(attendanceCounts(['present', 'online', 'absent', 'none', 'none']))
      .toMatchObject({ present: 1, online: 1, absent: 1, none: 2, here: 2, total: 5 });
  });
});

describe('material input', () => {
  it('accepts pdf and html, rejects the rest', () => {
    expect(classifyMaterialFile({ name: 'a.pdf', type: 'application/pdf', size: 1 })).toEqual({ ok: true, kind: 'pdf' });
    expect(classifyMaterialFile({ name: 'a.htm', type: '', size: 1 })).toEqual({ ok: true, kind: 'html' });
    expect(classifyMaterialFile({ name: 'a.docx', type: '', size: 1 }).ok).toBe(false);
    expect(classifyMaterialFile({ name: 'a.html', type: 'text/html', size: 11 * 1024 * 1024 }).ok).toBe(false);
  });
  it('normalises links', () => {
    expect(normaliseMaterialLink('example.com/x')).toBe('https://example.com/x');
    expect(normaliseMaterialLink('javascript:alert(1)')).toBeNull();
    expect(normaliseMaterialLink('  ')).toBeNull();
  });
});

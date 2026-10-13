'use client';

/**
 * Roster + attendance state for the active class. Preserves the old sheet's
 * behaviour: per-row optimistic autosave (350 ms debounce, single-record PUT),
 * retry on failure, and the online-attendance hard cap.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  attendanceCounts, attendanceFromRoster, attendanceRecord, cycleAttendance,
  type AttendanceState,
} from '@/lib/lms/today-cockpit';
import { apiJson, ApiError } from './cockpit-ui';

export interface RosterStudent {
  userId: number;
  name: string;
  email: string;
  state: 'unmarked' | 'present' | 'absent';
  present: boolean;
  mode: 'online' | 'offline';
  source: 'manual' | 'join' | 'pulled' | null;
  totalAbsences: number;
  absencesLast7Days: number;
  onlineCount: number;
  onlineCapped: boolean;
}

export type RowSave = 'pending' | 'saving' | 'error';

const SAVE_DEBOUNCE_MS = 350;

export function useRoster(sessionId: number | null, notify: (m: string) => void) {
  const [students, setStudents] = useState<RosterStudent[] | null>(null);
  const [marks, setMarks] = useState<Record<number, AttendanceState>>({});
  const [rowSave, setRowSave] = useState<Record<number, RowSave>>({});
  const [loadError, setLoadError] = useState('');
  // Students already online for THIS class on the server — they may stay online
  // even when capped (re-saving is not new usage).
  const serverOnline = useRef<Set<number>>(new Set());
  const marksRef = useRef(marks);
  marksRef.current = marks;
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const sessionRef = useRef(sessionId);
  sessionRef.current = sessionId;
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const clearRow = (userId: number) => setRowSave(p => {
    const n = { ...p };
    delete n[userId];
    return n;
  });

  const load = useCallback(async (id: number, signal: { cancelled: boolean }) => {
    setLoadError('');
    try {
      const json = await apiJson<{ students: RosterStudent[] }>(`/api/lms/admin/classes/${id}/attendance/roster`);
      if (signal.cancelled) return;
      setStudents(json.students);
      const m: Record<number, AttendanceState> = {};
      const online = new Set<number>();
      for (const s of json.students) {
        m[s.userId] = attendanceFromRoster(s);
        if (s.state === 'present' && s.mode === 'online') online.add(s.userId);
      }
      serverOnline.current = online;
      setMarks(m);
    } catch (e) {
      if (!signal.cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to load roster');
    }
  }, []);

  useEffect(() => {
    setStudents(null);
    setMarks({});
    setRowSave({});
    if (sessionId == null) return;
    const signal = { cancelled: false };
    void load(sessionId, signal);
    const t = timers.current;
    return () => {
      signal.cancelled = true;
      // Autosave must survive leaving the class/page: flush pending rows now
      // instead of dropping them.
      t.forEach((timer, userId) => {
        clearTimeout(timer);
        const state = marksRef.current[userId];
        if (state) {
          void fetch(`/api/lms/admin/classes/${sessionId}/attendance`, {
            method: 'PUT',
            keepalive: true,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ records: [{ userId, ...attendanceRecord(state) }] }),
          }).catch(() => {});
        }
      });
      t.clear();
    };
  }, [sessionId, load]);

  const save = useCallback(async (userId: number, state: AttendanceState, previous: AttendanceState) => {
    const id = sessionRef.current;
    if (id == null) return;
    setRowSave(p => ({ ...p, [userId]: 'saving' }));
    try {
      await apiJson(`/api/lms/admin/classes/${id}/attendance`, {
        method: 'PUT',
        json: { records: [{ userId, ...attendanceRecord(state) }] },
      });
      if (state === 'online') serverOnline.current.add(userId); else serverOnline.current.delete(userId);
      clearRow(userId);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'ONLINE_CAP_REACHED') {
        setMarks(p => ({ ...p, [userId]: previous }));
        clearRow(userId);
        notifyRef.current(e.message);
        return;
      }
      setRowSave(p => ({ ...p, [userId]: 'error' }));
    }
  }, []);

  const schedule = useCallback((userId: number, state: AttendanceState, previous: AttendanceState) => {
    setRowSave(p => ({ ...p, [userId]: 'pending' }));
    const existing = timers.current.get(userId);
    if (existing) clearTimeout(existing);
    timers.current.set(userId, setTimeout(() => {
      timers.current.delete(userId);
      void save(userId, state, previous);
    }, SAVE_DEBOUNCE_MS));
  }, [save]);

  const tap = useCallback((userId: number) => {
    const row = students?.find(s => s.userId === userId);
    if (!row) return;
    const cur = marksRef.current[userId] ?? 'none';
    const blocked = row.onlineCapped && !serverOnline.current.has(userId);
    const next = cycleAttendance(cur, blocked);
    if (blocked && cur === 'present') {
      notifyRef.current(`${row.name.split(' ')[0]} is at the online cap (8), so online was skipped.`);
    }
    setMarks(p => ({ ...p, [userId]: next }));
    schedule(userId, next, cur);
  }, [students, schedule]);

  const markAllPresent = useCallback(async () => {
    const id = sessionRef.current;
    if (id == null || !students) return;
    const changed = students.filter(s => {
      const st = marksRef.current[s.userId] ?? 'none';
      return st === 'none'; // never override an explicit absent
    });
    if (changed.length === 0) { notifyRef.current('Nobody is left unmarked.'); return; }
    const previous = new Map(changed.map(s => [s.userId, marksRef.current[s.userId] ?? 'none'] as const));
    changed.forEach(s => {
      const t = timers.current.get(s.userId);
      if (t) { clearTimeout(t); timers.current.delete(s.userId); }
    });
    setMarks(p => {
      const n = { ...p };
      changed.forEach(s => { n[s.userId] = 'present'; });
      return n;
    });
    setRowSave(p => {
      const n = { ...p };
      changed.forEach(s => { n[s.userId] = 'saving'; });
      return n;
    });
    try {
      await apiJson(`/api/lms/admin/classes/${id}/attendance`, {
        method: 'PUT',
        json: { records: changed.map(s => ({ userId: s.userId, state: 'present', mode: 'offline' })) },
      });
      changed.forEach(s => serverOnline.current.delete(s.userId));
      setRowSave(p => {
        const n = { ...p };
        changed.forEach(s => { delete n[s.userId]; });
        return n;
      });
      notifyRef.current(`Marked ${changed.length} present.`);
    } catch (e) {
      setMarks(p => {
        const n = { ...p };
        changed.forEach(s => { n[s.userId] = previous.get(s.userId) ?? 'none'; });
        return n;
      });
      setRowSave(p => {
        const n = { ...p };
        changed.forEach(s => { delete n[s.userId]; });
        return n;
      });
      notifyRef.current(e instanceof Error ? `Could not mark all present: ${e.message}` : 'Could not mark all present.');
    }
  }, [students]);

  const retry = useCallback((userId: number) => {
    const state = marksRef.current[userId];
    if (state) void save(userId, state, state);
  }, [save]);

  const states = students ? students.map(s => marks[s.userId] ?? 'none') : [];
  const counts = attendanceCounts(states);
  const absentees = students ? students.filter(s => {
    return (marks[s.userId] ?? 'none') === 'absent'; // unmarked counts as present
  }) : [];
  const unsaved = Object.keys(rowSave).length;

  return {
    students, marks, rowSave, loadError, counts, absentees, unsaved,
    loading: students === null && !loadError,
    tap, markAllPresent, retry,
    reload: () => { if (sessionId != null) void load(sessionId, { cancelled: false }); },
  };
}

'use client';

import React, { useState, useCallback, useEffect, useRef, useImperativeHandle } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video, Upload, BookOpen, CheckCircle, Users, Clock,
  ExternalLink, CalendarX, ChevronRight, Loader2, Check, KeyRound, ClipboardCheck,
} from 'lucide-react';
import { uploadToR2 } from '@/lib/lms/upload-client';
import { trackFeature } from '@/lib/analytics/tracker';
import {
  SubjectBadge, StatusBadge, Toast, ConfirmDialog, Modal, useConfirm,
  FieldLabel, FieldInput, FieldSelect, FieldTextarea, PrimaryBtn, GhostBtn,
  FormActions,
  fmtDhaka, dhakaLocalToISO, SPIN_CSS, RED, SLATE, BORDER, MUTED, BG,
  rowV, SURFACE, SURFACE_ALT, OK, OK_BG, WARN, WARN_BG, INK_SOFT,
  RED_HOVER, R_SM, R_MD, R_LG, R_PILL, SHADOW_SM, FONT_HEADING, T_XS, T_SM, T_BASE, T_MD, T_LG,
} from './lms-shared';
import { suggestMaterialFields, type MaterialSuggestion } from '@/lib/naming/suggest';
import { formatMaterialName } from '@/lib/naming/format-name';
import { COURSES, SUBJECTS, DOC_TYPES } from '@/lib/naming/taxonomy';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OfflineShowcaseEntry {
  submissionId: number;
  userId: number;
  userName: string;
  userEmail: string;
  checked: boolean;
  submittedAt: number;
  assignmentId: number;
  assignmentTitle: string;
}

export interface TodaySession {
  id: number;
  title: string;
  subject: string;
  product: string;
  batch: string | null;
  scheduledAt: number;
  durationMinutes: number;
  status: string;
  meetLink: string | null;
  attendanceCount: number;
  materialsCount: number;
  pendingReviewCount: number;
  offlineShowcase: OfflineShowcaseEntry[];
}

interface TodayData {
  sessions: TodaySession[];
  assignmentsDue48h: number;
}

export interface BatchOption {
  id: number;
  name: string;
  product: string;
  status: string;
}

interface Props {
  initial: TodayData;
  sessions: TodaySession[]; // upcoming sessions for "next" empty state
  batches: BatchOption[];
}

// ─── Close guard handle ───────────────────────────────────────────────────────
// Exposed by sheets rendered inside a `Modal` so the parent can wire the
// Modal's `confirmClose` prop to the sheet's own in-flight/dirty state.

export interface CloseGuardHandle {
  canClose: () => boolean | Promise<boolean>;
}

// ─── Interactive-state CSS (hover + focus-visible) ─────────────────────────────
// Applied via className to raw <button>/<a>/<input> elements in this file that
// don't already go through a shared component with built-in states.

const INT_CSS = `
.lms-int:focus-visible { outline: 2px solid ${RED}; outline-offset: 2px; border-radius: ${R_SM}px; }
.lms-int:hover { opacity: 0.92; }
.lms-primary:hover { background: ${RED_HOVER} !important; opacity: 1; }
`;

// ─── Upload PDF Sheet ─────────────────────────────────────────────────────────

const UploadSheet = React.forwardRef<CloseGuardHandle, {
  session: TodaySession; onClose: () => void; onDone: () => void;
}>(function UploadSheet({ session, onClose, onDone }, ref) {
  const [file,    setFile]    = useState<File | null>(null);
  const [title,   setTitle]   = useState('');
  const [progress, setProgress] = useState(0);
  const [stage,   setStage]   = useState<'idle' | 'uploading' | 'saving' | 'done'>('idle');
  const [error,   setError]   = useState('');
  // docType/number/topic derived from the filename via the same autofill
  // engine the Materials screen uses (suggestMaterialFields). This sheet has
  // no selects for these fields — they're always inherited/derived, never
  // admin-editable here — so unlike the Materials screen's "touched" guard,
  // a re-pick of the file always recomputes them.
  const [suggestion, setSuggestion] = useState<MaterialSuggestion | null>(null);
  const [confirm, confirmDialog] = useConfirm();

  useImperativeHandle(ref, () => ({
    canClose: () => {
      if (stage === 'uploading' || stage === 'saving') {
        return confirm({
          title: 'Upload in progress',
          message: 'Upload is still in progress. Close anyway?',
          confirmLabel: 'Close anyway',
          destructive: true,
        });
      }
      if (stage === 'idle' && (file || title.trim())) {
        return confirm({
          title: 'Discard this upload?',
          message: 'The selected file and title will be lost.',
          confirmLabel: 'Discard',
          destructive: true,
        });
      }
      return true;
    },
  }), [stage, file, title, confirm]);

  const handleUpload = async () => {
    if (!file) { setError('Choose a PDF file to upload'); return; }
    setError('');
    try {
      setStage('uploading');
      const { key } = await uploadToR2({
        file,
        endpoint: '/api/lms/admin/materials/upload',
        onProgress: pct => setProgress(pct),
      });
      setStage('saving');
      const res = await fetch('/api/lms/admin/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || file.name.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' '),
          type: 'pdf',
          blobUrl: key,
          fileName: file.name,
          fileSize: file.size,
          classSessionId: session.id,
          // Subject/product are intentionally not sent — the server always
          // inherits those from the linked session (see materials/route.ts).
          docType: suggestion?.docType ?? DOC_TYPES[0].key,
          number: suggestion?.number ?? null,
          topic: suggestion?.topic ?? null,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      trackFeature('material_uploaded', 'lms', { classSessionId: session.id, source: 'today' });
      setStage('done');
      setTimeout(() => { onDone(); onClose(); }, 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
      setStage('idle');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <FieldLabel>Lecture title</FieldLabel>
        <FieldInput
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Class Notes – Week 3"
        />
      </div>
      <div>
        <FieldLabel>PDF File *</FieldLabel>
        <input
          type="file"
          accept="application/pdf"
          onChange={e => {
            const nextFile = e.target.files?.[0] ?? null;
            setFile(nextFile);
            if (!nextFile) { setSuggestion(null); return; }
            const s = suggestMaterialFields(nextFile.name);
            setSuggestion(s);
            if (!title.trim()) {
              // Prefer the session's own (already-known) subject/course when
              // they're real taxonomy values, same as the Materials screen's
              // inherited-title logic; fall back to whatever the filename
              // itself suggests when the session doesn't have one yet
              // (e.g. an auto-generated session with subject 'tbd').
              const inheritedSubject = SUBJECTS.find(x => x.key === session.subject)?.key;
              const inheritedCourse  = COURSES.find(x => x.key === session.product)?.key;
              const subjectForTitle = inheritedSubject ?? s.subject;
              setTitle(subjectForTitle
                ? formatMaterialName({
                    course: inheritedCourse ?? s.course ?? COURSES[0].key,
                    subject: subjectForTitle,
                    docType: s.docType ?? DOC_TYPES[0].key,
                    number: s.number,
                    topic: s.topic,
                  })
                : nextFile.name.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' '));
            }
          }}
          className="lms-int"
          style={{ width: '100%', minHeight: 44, padding: '10px 12px', fontSize: T_BASE, color: SLATE, border: `1px solid ${BORDER}`, borderRadius: R_MD, background: SURFACE }}
        />
        {file && (
          <p style={{ margin: '4px 0 0', fontSize: T_XS, color: MUTED }}>
            {file.name} — {(file.size / 1024 / 1024).toFixed(1)} MB
          </p>
        )}
        <p style={{ margin: '5px 0 0', fontSize: T_XS, lineHeight: 1.5, color: MUTED }}>
          Course, subject, batch, and access are inherited from this class automatically.
        </p>
      </div>
      {stage === 'uploading' && (
        <div>
          <div style={{ background: SURFACE_ALT, borderRadius: 4, height: 4 }}>
            <div style={{
              height: 4, borderRadius: 4, background: RED,
              width: '100%', transform: `scaleX(${progress / 100})`, transformOrigin: 'left', transition: 'transform 0.3s',
            }} />
          </div>
          <p style={{ fontSize: T_XS, color: MUTED, margin: '4px 0 0' }}>Uploading… {progress}%</p>
        </div>
      )}
      {error && <p style={{ fontSize: T_SM, color: RED, margin: 0 }}>{error}</p>}
      <FormActions>
        <GhostBtn onClick={onClose} small>Cancel</GhostBtn>
        <PrimaryBtn
          onClick={handleUpload}
          disabled={!file || stage !== 'idle'}
          loading={stage === 'uploading' || stage === 'saving'}
          small
        >
          {stage === 'done' ? 'Uploaded!' : 'Upload PDF'}
        </PrimaryBtn>
      </FormActions>
      {confirmDialog}
    </div>
  );
});

// ─── Post Homework Sheet ──────────────────────────────────────────────────────

const HomeworkSheet = React.forwardRef<CloseGuardHandle, {
  session: TodaySession; batches: BatchOption[]; onClose: () => void; onDone: () => void;
}>(function HomeworkSheet({ session, batches, onClose, onDone }, ref) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    dueAt: '',
    batch: session.batch ?? '',
  });
  const [saving, setSaving]  = useState(false);
  const [error,  setError]   = useState('');
  const [confirm, confirmDialog] = useConfirm();

  const f = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  useImperativeHandle(ref, () => ({
    canClose: () => {
      if (saving) {
        return confirm({
          title: 'Homework post in progress',
          message: 'Homework post is still saving. Close anyway?',
          confirmLabel: 'Close anyway',
          destructive: true,
        });
      }
      const dirty = form.title.trim() !== '' || form.description.trim() !== ''
        || form.dueAt !== '' || form.batch !== (session.batch ?? '');
      if (dirty) {
        return confirm({
          title: 'Discard this homework draft?',
          message: 'Your unsaved changes will be lost.',
          confirmLabel: 'Discard',
          destructive: true,
        });
      }
      return true;
    },
  }), [saving, form, session.batch, confirm]);

  const handleSave = async () => {
    if (!form.title.trim() || !form.description.trim() || !form.dueAt) {
      setError('Title, description and due date are required'); return;
    }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/lms/admin/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          subject: session.subject,
          product: session.product,
          batch: form.batch || null,
          classSessionId: session.id,
          dueAt: dhakaLocalToISO(form.dueAt),
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      onDone(); onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <FieldLabel>Title *</FieldLabel>
        <FieldInput value={form.title} onChange={e => f('title', e.target.value)} placeholder="Homework title" />
      </div>
      <div>
        <FieldLabel>Instructions *</FieldLabel>
        <FieldTextarea value={form.description} onChange={e => f('description', e.target.value)} placeholder="Describe the task…" />
      </div>
      <div>
        <FieldLabel>Due Date (Dhaka time) *</FieldLabel>
        <FieldInput type="datetime-local" value={form.dueAt} onChange={e => f('dueAt', e.target.value)} />
      </div>
      <div>
        <FieldLabel>Batch (leave blank for all)</FieldLabel>
        <FieldSelect value={form.batch} onChange={e => f('batch', e.target.value)}>
          <option value="">All batches</option>
          {batches.filter(b => b.product === session.product).map(b => (
            <option key={b.id} value={b.name}>{b.name}</option>
          ))}
        </FieldSelect>
      </div>
      {error && <p style={{ fontSize: T_SM, color: RED, margin: 0 }}>{error}</p>}
      <FormActions>
        <GhostBtn onClick={onClose} small>Cancel</GhostBtn>
        <PrimaryBtn onClick={handleSave} loading={saving} small>Post Homework</PrimaryBtn>
      </FormActions>
      {confirmDialog}
    </div>
  );
});

// ─── Attendance Sheet ─────────────────────────────────────────────────────────

interface RosterStudentHistoryEntry {
  sessionId: number;
  title: string;
  scheduledAt: number; // ms
  present: boolean;
  mode: 'online' | 'offline' | null;
}

interface RosterStudent {
  userId: number;
  name: string;
  email: string;
  present: boolean;
  mode: 'online' | 'offline';
  source: 'manual' | 'join' | 'pulled' | null;
  totalAbsences: number;
  absencesLast7Days: number;
  lexicalPoints: number;
  onlineCount: number;
  onlineCapped: boolean;
  history: RosterStudentHistoryEntry[];
}

const AttendanceSheet = React.forwardRef<CloseGuardHandle, {
  session: TodaySession; onClose: () => void; onDone: () => void;
}>(function AttendanceSheet({ session, onClose, onDone }, ref) {
  const [students, setStudents] = useState<RosterStudent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]  = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  // Per-row autosave state: 'pending' = debounce running, 'saving' = PATCH in
  // flight, 'error' = last save failed and needs a retry. No entry = saved.
  const [rowStatus, setRowStatus] = useState<Record<number, 'pending' | 'saving' | 'error'>>({});
  const saveTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const [confirm, confirmDialog] = useConfirm();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/lms/admin/classes/${session.id}/attendance/roster`);
        if (!res.ok) throw new Error('Failed to load roster');
        const json = await res.json() as { students: RosterStudent[] };
        if (!cancelled) setStudents(json.students);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load roster');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [session.id]);

  // Cancel any debounce timers still waiting when the sheet unmounts. A timer
  // only exists while a row is 'pending'; canClose() below blocks closing on
  // 'pending'/'saving'/'error' rows, so by the time unmount happens any real
  // edit has either already reached the server or the admin explicitly chose
  // to discard it.
  useEffect(() => {
    return () => {
      saveTimers.current.forEach(t => clearTimeout(t));
      saveTimers.current.clear();
    };
  }, []);

  // No per-row attendance endpoint exists — this reuses the bulk PUT
  // (/api/lms/admin/classes/[id]/attendance) with a single-record `records`
  // array. The route already upserts/deletes per record independently, so a
  // one-record call is a safe, additive per-row save (assumption: this route
  // shape is stable — verified by reading its handler before writing this).
  const saveRow = useCallback(async (userId: number, present: boolean, mode: 'online' | 'offline') => {
    setRowStatus(prev => ({ ...prev, [userId]: 'saving' }));
    try {
      const res = await fetch(`/api/lms/admin/classes/${session.id}/attendance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: [{ userId, present, mode }] }),
      });
      if (!res.ok) throw new Error('Save failed');
      setRowStatus(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    } catch {
      setRowStatus(prev => ({ ...prev, [userId]: 'error' }));
    }
  }, [session.id]);

  const scheduleSave = useCallback((userId: number, present: boolean, mode: 'online' | 'offline') => {
    setRowStatus(prev => ({ ...prev, [userId]: 'pending' }));
    const existing = saveTimers.current.get(userId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      saveTimers.current.delete(userId);
      void saveRow(userId, present, mode);
    }, 350);
    saveTimers.current.set(userId, timer);
  }, [saveRow]);

  const togglePresent = (userId: number) => {
    if (!students) return;
    const next = students.map(s => s.userId === userId ? { ...s, present: !s.present } : s);
    setStudents(next);
    const row = next.find(s => s.userId === userId);
    if (row) scheduleSave(row.userId, row.present, row.mode);
  };
  const setMode = (userId: number, mode: 'online' | 'offline') => {
    if (!students) return;
    const next = students.map(s => s.userId === userId ? { ...s, mode } : s);
    setStudents(next);
    const row = next.find(s => s.userId === userId);
    if (row) scheduleSave(row.userId, row.present, row.mode);
  };
  const retryRow = (userId: number) => {
    const row = students?.find(s => s.userId === userId);
    if (row) void saveRow(row.userId, row.present, row.mode);
  };

  // Shared by the Modal's confirmClose guard (via the ref below) and the
  // in-sheet Done button — closing must never silently drop a row that
  // hasn't reached the server yet.
  const checkCanClose = useCallback((): boolean | Promise<boolean> => {
    const problems = Object.entries(rowStatus);
    if (problems.length === 0) return true;
    const hasError = problems.some(([, st]) => st === 'error');
    return confirm({
      title: hasError ? 'Attendance save failed' : 'Attendance still saving',
      message: hasError
        ? `${problems.length} attendance change(s) failed to save. Close anyway and lose them?`
        : 'Attendance is still saving. Close anyway?',
      confirmLabel: 'Close anyway',
      destructive: hasError,
    });
  }, [rowStatus, confirm]);

  useImperativeHandle(ref, () => ({ canClose: checkCanClose }), [checkCanClose]);

  const handleDone = async () => {
    if (!(await checkCanClose())) return;
    onDone(); onClose();
  };

  if (loading) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center' }}>
        <Loader2 size={20} style={{ color: MUTED, animation: 'spin 1s linear infinite' }} aria-hidden />
      </div>
    );
  }

  if (!students || students.length === 0) {
    return <p style={{ margin: 0, fontSize: T_BASE, color: MUTED }}>No students in scope for this class.</p>;
  }

  const presentCount = students.filter(s => s.present).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, fontSize: T_SM, color: MUTED }}>
        {presentCount} / {students.length} marked present — saved automatically as you toggle
      </p>

      <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {students.map(s => {
          const isExpanded = expandedId === s.userId;
          const lastPresent = s.history.find(h => h.present);
          const status = rowStatus[s.userId];

          return (
            <div key={s.userId}>
              {/* Main row */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '8px 12px',
                  borderRadius: isExpanded ? `${R_MD}px ${R_MD}px 0 0` : R_MD,
                  border: status === 'error' ? `1px solid ${RED}` : `1px solid ${BORDER}`,
                  borderBottom: isExpanded ? `1px solid ${BORDER}` : (status === 'error' ? `1px solid ${RED}` : `1px solid ${BORDER}`),
                  background: s.present ? OK_BG : SURFACE,
                }}
              >
                <input
                  type="checkbox"
                  checked={s.present}
                  onChange={() => togglePresent(s.userId)}
                  className="lms-int"
                  style={{ width: 16, height: 16, flexShrink: 0, cursor: 'pointer' }}
                />
                {/* A real button: this was a bare <div onClick>, so the only
                    way to open a student's absence history was a mouse, even
                    though the checkbox and the Offline/Online toggle either
                    side of it are both keyboard-reachable. */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : s.userId)}
                  aria-expanded={isExpanded}
                  className="lms-btn"
                  style={{
                    flex: 1, minWidth: 0, cursor: 'pointer',
                    padding: 0, border: 'none', background: 'none', textAlign: 'left',
                  }}
                >
                  <p style={{
                    margin: 0, fontSize: T_BASE, fontWeight: 600, color: SLATE,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {s.name}
                  </p>
                  <p style={{ margin: 0, fontSize: T_XS, color: MUTED }}>
                    {s.totalAbsences} absent total · {s.absencesLast7Days} in last 7d · {s.onlineCount}/8 online
                    {s.source === 'pulled' && ' · auto-pulled'}
                  </p>
                </button>
                {/* Segmented Offline | Online toggle */}
                <div style={{
                  display: 'flex', flexShrink: 0,
                  border: `1px solid ${BORDER}`, borderRadius: R_SM, overflow: 'hidden',
                  opacity: s.present ? 1 : 0.45,
                  pointerEvents: s.present ? 'auto' : 'none',
                }}>
                  {(['offline', 'online'] as const).map(opt => {
                    // Hard block: once capped, "Online" isn't offered as a NEW
                    // choice — the row already marked online can stay online
                    // (no disable there), but a currently-offline row can't
                    // switch to online anymore.
                    const capBlocksThis = opt === 'online' && s.onlineCapped && s.mode !== 'online';
                    return (
                      <button
                        key={opt}
                        onClick={() => setMode(s.userId, opt)}
                        disabled={!s.present || capBlocksThis}
                        title={capBlocksThis ? 'Online attendance cap (8) reached for this student' : undefined}
                        className="lms-int"
                        style={{
                          padding: '4px 8px', fontSize: T_XS, fontWeight: 600,
                          border: 'none', borderRight: opt === 'offline' ? `1px solid ${BORDER}` : 'none',
                          background: s.mode === opt ? RED : SURFACE,
                          color: s.mode === opt ? SURFACE : (capBlocksThis ? BORDER : MUTED),
                          cursor: s.present && !capBlocksThis ? 'pointer' : 'default',
                          textTransform: 'capitalize',
                          transition: 'background 0.12s, color 0.12s',
                        }}
                      >
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </button>
                    );
                  })}
                </div>
                {/* Autosave status */}
                {(status === 'pending' || status === 'saving') && (
                  <Loader2 size={14} style={{ color: MUTED, animation: 'spin 1s linear infinite', flexShrink: 0 }} aria-hidden />
                )}
                {status === 'error' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); retryRow(s.userId); }}
                    className="lms-int"
                    style={{
                      fontSize: 10, fontWeight: 700, color: RED,
                      background: SURFACE, border: `1px solid ${RED}`,
                      borderRadius: R_SM, padding: '4px 8px', cursor: 'pointer',
                      flexShrink: 0, whiteSpace: 'nowrap',
                    }}
                  >
                    Failed · Retry
                  </button>
                )}
              </div>

              {/* Expandable details panel */}
              {isExpanded && (
                <div style={{
                  border: `1px solid ${BORDER}`, borderTop: 'none',
                  borderRadius: `0 0 ${R_MD}px ${R_MD}px`,
                  padding: '12px',
                  background: SURFACE_ALT,
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <p style={{ margin: 0, fontSize: T_SM, color: SLATE }}>
                    <span style={{ color: MUTED }}>Email: </span>{s.email}
                  </p>
                  <p style={{ margin: 0, fontSize: T_SM, color: SLATE }}>
                    <span style={{ color: MUTED }}>Lexical points: </span>{s.lexicalPoints}
                  </p>
                  <p style={{ margin: 0, fontSize: T_SM, color: SLATE }}>
                    <span style={{ color: MUTED }}>Last attendance: </span>
                    {lastPresent ? fmtDhaka(lastPresent.scheduledAt, { dateStyle: 'medium' }) : 'Never'}
                  </p>
                  {s.history.length === 0 ? (
                    <p style={{ margin: 0, fontSize: T_XS, color: MUTED }}>No past classes yet.</p>
                  ) : (
                    <div style={{ overflowX: 'auto', marginTop: 4 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: T_XS }}>
                        <thead>
                          <tr>
                            {['Class', 'Present', 'Online', 'Offline'].map(col => (
                              <th key={col} style={{
                                padding: '4px 8px', textAlign: 'left', fontWeight: 700,
                                color: MUTED, borderBottom: `1px solid ${BORDER}`,
                                whiteSpace: 'nowrap',
                              }}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {s.history.map(h => (
                            <tr key={h.sessionId}>
                              <td style={{ padding: '4px 8px', color: SLATE, maxWidth: 140, borderBottom: `1px solid ${BORDER}` }}>
                                <p style={{
                                  margin: 0, overflow: 'hidden', textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap', fontWeight: 500,
                                }}>{h.title}</p>
                                <p style={{ margin: 0, color: MUTED, fontSize: 10 }}>
                                  {fmtDhaka(h.scheduledAt, { dateStyle: 'short' })}
                                </p>
                              </td>
                              <td style={{ padding: '4px 8px', textAlign: 'center', borderBottom: `1px solid ${BORDER}` }}>
                                {h.present ? <Check size={12} style={{ color: OK }} aria-hidden /> : <span style={{ color: MUTED }}>—</span>}
                              </td>
                              <td style={{ padding: '4px 8px', textAlign: 'center', borderBottom: `1px solid ${BORDER}` }}>
                                {h.present && h.mode === 'online' ? <Check size={12} style={{ color: OK }} aria-hidden /> : <span style={{ color: MUTED }}>—</span>}
                              </td>
                              <td style={{ padding: '4px 8px', textAlign: 'center', borderBottom: `1px solid ${BORDER}` }}>
                                {h.present && h.mode === 'offline' ? <Check size={12} style={{ color: OK }} aria-hidden /> : <span style={{ color: MUTED }}>—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && <p style={{ fontSize: T_SM, color: RED, margin: 0 }}>{error}</p>}

      <FormActions>
        <PrimaryBtn onClick={handleDone} small>Done</PrimaryBtn>
      </FormActions>
      {confirmDialog}
    </div>
  );
});

// ─── Offline Homework Sheet ───────────────────────────────────────────────────
// Students who chose "I'll show it in the next class" for an assignment
// matching this session's subject/product/batch. Checking a row is purely the
// instructor's own record of who presented in class — it does not affect the
// student's access to the assignment solution.

function OfflineHomeworkSheet({
  entries, onClose, onRefresh,
}: {
  entries: OfflineShowcaseEntry[]; onClose: () => void; onRefresh: () => void;
}) {
  const [rows, setRows] = useState(entries);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const toggleChecked = async (submissionId: number, checked: boolean) => {
    setSavingId(submissionId);
    setSaveError(null);
    setRows(prev => prev.map(r => r.submissionId === submissionId ? { ...r, checked } : r));
    try {
      const res = await fetch(`/api/lms/admin/submissions/${submissionId}/check`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checked }),
      });
      if (!res.ok) throw new Error('Failed');
    } catch {
      setRows(prev => prev.map(r => r.submissionId === submissionId ? { ...r, checked: !checked } : r));
      // The optimistic tick used to just snap back with no explanation, which
      // reads as "my click didn't register" rather than "the save failed".
      setSaveError("Couldn't save that change — it has been undone. Try again.");
    } finally {
      setSavingId(null);
    }
  };

  const sorted = [...rows].sort((a, b) => Number(a.checked) - Number(b.checked));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {saveError && (
        <p role="alert" style={{ margin: 0, fontSize: T_SM, color: RED, fontWeight: 500 }}>
          {saveError}
        </p>
      )}
      <p style={{ margin: 0, fontSize: T_SM, color: MUTED }}>
        {rows.filter(r => r.checked).length} / {rows.length} checked off
      </p>
      <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map(r => (
          <label
            key={r.submissionId}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
              borderRadius: R_MD, border: `1px solid ${BORDER}`, cursor: 'pointer',
              background: r.checked ? OK_BG : SURFACE,
            }}
          >
            <input
              type="checkbox"
              checked={r.checked}
              disabled={savingId === r.submissionId}
              onChange={() => void toggleChecked(r.submissionId, !r.checked)}
              className="lms-int"
              style={{ width: 16, height: 16, flexShrink: 0, cursor: 'pointer' }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                margin: 0, fontSize: T_BASE, fontWeight: 600, color: SLATE,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {r.userName}
              </p>
              <p style={{
                margin: 0, fontSize: T_XS, color: MUTED,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {r.assignmentTitle}
              </p>
            </div>
          </label>
        ))}
      </div>
      <FormActions>
        <GhostBtn small onClick={() => { onRefresh(); onClose(); }}>Close</GhostBtn>
      </FormActions>
    </div>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({ session, index, batches, onRefresh }: {
  session: TodaySession; index: number; batches: BatchOption[]; onRefresh: () => void;
}) {
  const [uploadOpen,   setUploadOpen]   = useState(false);
  const [hwOpen,       setHwOpen]       = useState(false);
  const [attOpen,      setAttOpen]      = useState(false);
  const [offlineOpen,  setOfflineOpen]  = useState(false);
  const [completing,   setCompleting]   = useState(false);
  const [confirmComp,  setConfirmComp]  = useState(false);
  const [toast,        setToast]        = useState<string | null>(null);

  const attendanceGuard = useRef<CloseGuardHandle>(null);
  const uploadGuard      = useRef<CloseGuardHandle>(null);
  const hwGuard           = useRef<CloseGuardHandle>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleMarkComplete = async () => {
    setConfirmComp(false);
    setCompleting(true);
    try {
      const res = await fetch(`/api/lms/admin/classes/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
      if (!res.ok) throw new Error('Failed');
      showToast('Marked as completed');
      onRefresh();
    } catch {
      showToast('Failed to update');
    } finally {
      setCompleting(false);
    }
  };

  const startTime = fmtDhaka(session.scheduledAt, { timeStyle: 'short' });
  const endEpoch  = session.scheduledAt + session.durationMinutes * 60000;
  const endTime   = fmtDhaka(endEpoch, { timeStyle: 'short' });
  const isDone    = session.status === 'completed';
  const isCancelled = session.status === 'cancelled';

  return (
    <>
      <style>{SPIN_CSS + INT_CSS}</style>
      <motion.div
        custom={index}
        variants={rowV}
        initial="hidden"
        animate="visible"
        style={{
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: R_LG,
          boxShadow: SHADOW_SM,
          padding: '16px 20px',
          opacity: isCancelled ? 0.55 : 1,
        }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: SLATE, letterSpacing: '-0.02em' }}>
              {session.title}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <SubjectBadge subject={session.subject} />
              <StatusBadge status={session.status} />
              {session.batch && (
                <span style={{ fontSize: T_XS, color: MUTED, background: BG, border: `1px solid ${BORDER}`, padding: '2px 8px', borderRadius: R_PILL }}>
                  Batch {session.batch}
                </span>
              )}
            </div>
          </div>
          <div style={{ flexShrink: 0, textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: T_MD, fontWeight: 700, color: SLATE, fontVariantNumeric: 'tabular-nums' }}>
              {startTime}
            </p>
            <p style={{ margin: 0, fontSize: T_XS, color: MUTED }}>→ {endTime}</p>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 16, rowGap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Users size={12} style={{ color: MUTED }} aria-hidden />
            <span style={{ fontSize: T_SM, color: INK_SOFT }}>{session.attendanceCount} attended</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <BookOpen size={12} style={{ color: MUTED }} aria-hidden />
            <span style={{ fontSize: T_SM, color: INK_SOFT }}>{session.materialsCount} materials</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={12} style={{ color: MUTED }} aria-hidden />
            <span style={{ fontSize: T_SM, color: INK_SOFT }}>{session.durationMinutes} min</span>
          </div>
          {session.pendingReviewCount > 0 && (
            <Link
              href="/admin/homework"
              className="lms-int"
              style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
            >
              <ClipboardCheck size={12} style={{ color: WARN }} aria-hidden />
              <span style={{ fontSize: T_SM, color: WARN, fontWeight: 600 }}>
                {session.pendingReviewCount} to review
              </span>
            </Link>
          )}
        </div>

        {/* Action buttons */}
        {!isCancelled && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <motion.button
              onClick={() => setAttOpen(true)}
              whileTap={{ scale: 0.96 }}
              className="lms-int lms-primary"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: R_MD,
                background: RED, border: '1px solid transparent',
                color: SURFACE, fontSize: T_SM, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Users size={12} aria-hidden />
              Take Attendance
            </motion.button>

            {session.meetLink && (
              <a
                href={session.meetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="lms-int"
                style={{ textDecoration: 'none' }}
              >
                <motion.div
                  whileTap={{ scale: 0.96 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', borderRadius: R_MD,
                    background: OK_BG,
                    border: `1px solid ${BORDER}`,
                    color: OK, fontSize: T_SM, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <Video size={12} aria-hidden />
                  Open Meet
                  <ExternalLink size={10} aria-hidden />
                </motion.div>
              </a>
            )}

            <motion.button
              onClick={() => setUploadOpen(true)}
              whileTap={{ scale: 0.96 }}
              className="lms-int"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: R_MD,
                background: SURFACE, border: `1px solid ${BORDER}`,
                color: INK_SOFT, fontSize: T_SM, fontWeight: 500, cursor: 'pointer',
              }}
            >
              <Upload size={12} aria-hidden />
              Upload PDF
            </motion.button>

            <motion.button
              onClick={() => setHwOpen(true)}
              whileTap={{ scale: 0.96 }}
              className="lms-int"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: R_MD,
                background: SURFACE, border: `1px solid ${BORDER}`,
                color: INK_SOFT, fontSize: T_SM, fontWeight: 500, cursor: 'pointer',
              }}
            >
              <BookOpen size={12} aria-hidden />
              Post Homework
            </motion.button>

            {session.offlineShowcase.length > 0 && (() => {
              const uncheckedCount = session.offlineShowcase.filter(e => !e.checked).length;
              return (
                <motion.button
                  onClick={() => setOfflineOpen(true)}
                  whileTap={{ scale: 0.96 }}
                  className="lms-int"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', borderRadius: R_MD,
                    background: uncheckedCount > 0 ? WARN_BG : OK_BG,
                    border: `1px solid ${BORDER}`,
                    color: uncheckedCount > 0 ? WARN : OK,
                    fontSize: T_SM, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <KeyRound size={12} aria-hidden />
                  Offline Homework · {session.offlineShowcase.length}
                </motion.button>
              );
            })()}

            {!isDone && (
              <motion.button
                onClick={() => setConfirmComp(true)}
                disabled={completing}
                whileTap={{ scale: 0.96 }}
                className="lms-int"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', borderRadius: R_MD,
                  background: SURFACE,
                  border: `1px solid ${BORDER}`,
                  color: RED, fontSize: T_SM, fontWeight: 500,
                  cursor: completing ? 'not-allowed' : 'pointer',
                  opacity: completing ? 0.6 : 1,
                }}
              >
                {completing
                  ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} aria-hidden /> Working…</>
                  : <><CheckCircle size={12} aria-hidden /> Mark Completed</>}
              </motion.button>
            )}
          </div>
        )}
      </motion.div>

      {/* Inline modals */}
      <Modal
        open={attOpen} onClose={() => setAttOpen(false)}
        title={`Attendance — ${session.title}`} width={480}
        confirmClose={() => attendanceGuard.current?.canClose() ?? true}
      >
        <AttendanceSheet
          ref={attendanceGuard}
          session={session}
          onClose={() => setAttOpen(false)}
          onDone={() => { showToast('Attendance saved'); onRefresh(); }}
        />
      </Modal>

      <Modal
        open={uploadOpen} onClose={() => setUploadOpen(false)}
        title={`Upload PDF — ${session.title}`} width={480}
        confirmClose={() => uploadGuard.current?.canClose() ?? true}
      >
        <UploadSheet ref={uploadGuard} session={session} onClose={() => setUploadOpen(false)} onDone={() => showToast('PDF uploaded')} />
      </Modal>

      <Modal
        open={hwOpen} onClose={() => setHwOpen(false)}
        title={`Post Homework — ${session.title}`} width={480}
        confirmClose={() => hwGuard.current?.canClose() ?? true}
      >
        <HomeworkSheet ref={hwGuard} session={session} batches={batches} onClose={() => setHwOpen(false)} onDone={() => showToast('Homework posted')} />
      </Modal>

      <Modal open={offlineOpen} onClose={() => setOfflineOpen(false)} title={`Offline Homework — ${session.title}`} width={480}>
        <OfflineHomeworkSheet
          entries={session.offlineShowcase}
          onClose={() => setOfflineOpen(false)}
          onRefresh={onRefresh}
        />
      </Modal>

      <ConfirmDialog
        open={confirmComp}
        title="Mark session as completed?"
        message={`"${session.title}" will be marked completed and students will see it in their history.`}
        confirmLabel="Mark Completed"
        onConfirm={handleMarkComplete}
        onCancel={() => setConfirmComp(false)}
        loading={completing}
      />

      <Toast message={toast} />
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TodayClient({ initial, batches }: Props) {
  const [data, setData] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/lms/admin/today');
      const json = await res.json() as { sessions: TodaySession[]; assignmentsDue48h: number };
      setData(json);
    } catch {
      setToast('Could not refresh');
    } finally {
      setRefreshing(false);
    }
  }, []);

  const today = new Date();
  const dateLabel = new Intl.DateTimeFormat('en-BD', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Dhaka',
  }).format(today);

  return (
    <>
      <style>{SPIN_CSS + INT_CSS}</style>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: SLATE, letterSpacing: '-0.02em', lineHeight: 1.2, fontFamily: FONT_HEADING }}>
            Today
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: T_BASE, color: MUTED }}>{dateLabel}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {data.assignmentsDue48h > 0 && (
            <span style={{
              padding: '4px 12px', borderRadius: R_PILL, fontSize: T_XS, fontWeight: 600,
              background: WARN_BG, color: WARN,
              border: `1px solid ${BORDER}`,
            }}>
              {data.assignmentsDue48h} homework due in 48h
            </span>
          )}
          <motion.button
            onClick={refresh}
            disabled={refreshing}
            whileTap={{ scale: 0.96 }}
            className="lms-int"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: R_MD,
              background: SURFACE, border: `1px solid ${BORDER}`,
              color: INK_SOFT, fontSize: T_SM, fontWeight: 500, cursor: 'pointer',
            }}
          >
            <Loader2
              size={12}
              style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}
              aria-hidden
            />
            Refresh
          </motion.button>
        </div>
      </div>

      {/* Sessions */}
      {data.sessions.length === 0 ? (
        <div style={{
          background: BG, border: `1px dashed ${BORDER}`,
          borderRadius: R_LG, padding: '48px 24px', textAlign: 'center',
        }}>
          <CalendarX size={32} style={{ color: MUTED, margin: '0 auto 12px', display: 'block' }} aria-hidden />
          <p style={{ margin: '0 0 8px', fontSize: T_LG, fontWeight: 600, color: SLATE, fontFamily: FONT_HEADING }}>No class today</p>
          <p style={{ margin: '0 0 16px', fontSize: T_BASE, color: MUTED }}>
            No sessions scheduled for today in Dhaka time.
          </p>
          <Link href="/admin/classes" className="lms-int lms-primary" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: R_MD, background: RED,
            color: SURFACE, fontSize: T_BASE, fontWeight: 600,
            textDecoration: 'none',
          }}>
            Go to Classes
            <ChevronRight size={14} aria-hidden />
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <AnimatePresence>
            {data.sessions.map((s, i) => (
              <SessionCard key={s.id} session={s} index={i} batches={batches} onRefresh={refresh} />
            ))}
          </AnimatePresence>
        </div>
      )}

      <Toast message={toast} />
    </>
  );
}

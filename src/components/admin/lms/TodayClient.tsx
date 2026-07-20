'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video, Upload, BookOpen, CheckCircle, Users, Clock,
  ExternalLink, CalendarX, ChevronRight, Loader2, Check, KeyRound,
} from 'lucide-react';
import { uploadToR2 } from '@/lib/lms/upload-client';
import { trackFeature } from '@/lib/analytics/tracker';
import {
  SubjectBadge, StatusBadge, Toast, ConfirmDialog, Modal,
  FieldLabel, FieldInput, FieldTextarea, PrimaryBtn, GhostBtn,
  fmtDhaka, dhakaLocalToISO, SPIN_CSS, RED, SLATE, BORDER, MUTED, BG,
  rowV,
} from './lms-shared';

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
  offlineShowcase: OfflineShowcaseEntry[];
}

interface TodayData {
  sessions: TodaySession[];
  assignmentsDue48h: number;
}

interface Props {
  initial: TodayData;
  sessions: TodaySession[]; // upcoming sessions for "next" empty state
}

// ─── Upload PDF Sheet ─────────────────────────────────────────────────────────

function UploadSheet({
  session, onClose, onDone,
}: {
  session: TodaySession; onClose: () => void; onDone: () => void;
}) {
  const [file,    setFile]    = useState<File | null>(null);
  const [title,   setTitle]   = useState('');
  const [progress, setProgress] = useState(0);
  const [stage,   setStage]   = useState<'idle' | 'uploading' | 'saving' | 'done'>('idle');
  const [error,   setError]   = useState('');

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
            if (nextFile && !title.trim()) {
              setTitle(nextFile.name.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' '));
            }
          }}
          style={{ width: '100%', minHeight: 44, padding: '10px 12px', fontSize: 13, color: SLATE, border: `1px solid ${BORDER}`, borderRadius: 10, background: '#FFFFFF' }}
        />
        {file && (
          <p style={{ margin: '4px 0 0', fontSize: 11, color: MUTED }}>
            {file.name} — {(file.size / 1024 / 1024).toFixed(1)} MB
          </p>
        )}
        <p style={{ margin: '5px 0 0', fontSize: 11, lineHeight: 1.5, color: MUTED }}>
          Course, subject, batch, and access are inherited from this class automatically.
        </p>
      </div>
      {stage === 'uploading' && (
        <div>
          <div style={{ background: '#F3F4F6', borderRadius: 4, height: 4 }}>
            <div style={{
              height: 4, borderRadius: 4, background: RED,
              width: '100%', transform: `scaleX(${progress / 100})`, transformOrigin: 'left', transition: 'transform 0.3s',
            }} />
          </div>
          <p style={{ fontSize: 11, color: MUTED, margin: '4px 0 0' }}>Uploading… {progress}%</p>
        </div>
      )}
      {error && <p style={{ fontSize: 12, color: RED, margin: 0 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <GhostBtn onClick={onClose} small>Cancel</GhostBtn>
        <PrimaryBtn
          onClick={handleUpload}
          disabled={!file || stage !== 'idle'}
          loading={stage === 'uploading' || stage === 'saving'}
          small
        >
          {stage === 'done' ? 'Uploaded!' : 'Upload PDF'}
        </PrimaryBtn>
      </div>
    </div>
  );
}

// ─── Post Homework Sheet ──────────────────────────────────────────────────────

function HomeworkSheet({
  session, onClose, onDone,
}: {
  session: TodaySession; onClose: () => void; onDone: () => void;
}) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    dueAt: '',
    batch: session.batch ?? '',
  });
  const [saving, setSaving]  = useState(false);
  const [error,  setError]   = useState('');

  const f = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

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
        <FieldInput value={form.batch} onChange={e => f('batch', e.target.value)} placeholder="e.g. 2025" />
      </div>
      {error && <p style={{ fontSize: 12, color: RED, margin: 0 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <GhostBtn onClick={onClose} small>Cancel</GhostBtn>
        <PrimaryBtn onClick={handleSave} loading={saving} small>Post Homework</PrimaryBtn>
      </div>
    </div>
  );
}

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
  totalAbsences: number;
  absencesLast7Days: number;
  lexicalPoints: number;
  history: RosterStudentHistoryEntry[];
}

function AttendanceSheet({
  session, onClose, onDone,
}: {
  session: TodaySession; onClose: () => void; onDone: () => void;
}) {
  const [students, setStudents] = useState<RosterStudent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]  = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

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

  const togglePresent = (userId: number) => {
    setStudents(prev => prev?.map(s => s.userId === userId ? { ...s, present: !s.present } : s) ?? null);
  };
  const setMode = (userId: number, mode: 'online' | 'offline') => {
    setStudents(prev => prev?.map(s => s.userId === userId ? { ...s, mode } : s) ?? null);
  };

  const handleSave = async () => {
    if (!students) return;
    setSaving(true); setError('');
    try {
      const res = await fetch(`/api/lms/admin/classes/${session.id}/attendance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: students.map(s => ({ userId: s.userId, present: s.present, mode: s.mode })),
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      onDone(); onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center' }}>
        <Loader2 size={20} style={{ color: MUTED, animation: 'spin 1s linear infinite' }} aria-hidden />
      </div>
    );
  }

  if (!students || students.length === 0) {
    return <p style={{ margin: 0, fontSize: 13, color: MUTED }}>No students in scope for this class.</p>;
  }

  const presentCount = students.filter(s => s.present).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 12, color: MUTED }}>
        {presentCount} / {students.length} marked present
      </p>

      <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {students.map(s => {
          const isExpanded = expandedId === s.userId;
          const lastPresent = s.history.find(h => h.present);

          return (
            <div key={s.userId}>
              {/* Main row */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px',
                  borderRadius: isExpanded ? '8px 8px 0 0' : 8,
                  border: `1px solid ${BORDER}`,
                  borderBottom: isExpanded ? `1px solid ${BORDER}` : `1px solid ${BORDER}`,
                  background: s.present ? 'rgba(16,185,129,0.06)' : '#FFFFFF',
                }}
              >
                <input
                  type="checkbox"
                  checked={s.present}
                  onChange={() => togglePresent(s.userId)}
                  style={{ width: 16, height: 16, flexShrink: 0, cursor: 'pointer' }}
                />
                <div
                  style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                  onClick={() => setExpandedId(isExpanded ? null : s.userId)}
                >
                  <p style={{
                    margin: 0, fontSize: 13, fontWeight: 600, color: SLATE,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {s.name}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
                    {s.totalAbsences} absent total · {s.absencesLast7Days} in last 7d
                  </p>
                </div>
                {/* Segmented Offline | Online toggle */}
                <div style={{
                  display: 'flex', flexShrink: 0,
                  border: `1px solid ${BORDER}`, borderRadius: 6, overflow: 'hidden',
                  opacity: s.present ? 1 : 0.45,
                  pointerEvents: s.present ? 'auto' : 'none',
                }}>
                  {(['offline', 'online'] as const).map(opt => (
                    <button
                      key={opt}
                      onClick={() => setMode(s.userId, opt)}
                      disabled={!s.present}
                      style={{
                        padding: '4px 9px', fontSize: 11, fontWeight: 600,
                        border: 'none', borderRight: opt === 'offline' ? `1px solid ${BORDER}` : 'none',
                        background: s.mode === opt ? RED : '#FFFFFF',
                        color: s.mode === opt ? '#FFFFFF' : MUTED,
                        cursor: s.present ? 'pointer' : 'default',
                        textTransform: 'capitalize',
                        transition: 'background 0.12s, color 0.12s',
                      }}
                    >
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Expandable details panel */}
              {isExpanded && (
                <div style={{
                  border: `1px solid ${BORDER}`, borderTop: 'none',
                  borderRadius: '0 0 8px 8px',
                  padding: '10px 12px',
                  background: BG,
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                  <p style={{ margin: 0, fontSize: 12, color: SLATE }}>
                    <span style={{ color: MUTED }}>Email: </span>{s.email}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: SLATE }}>
                    <span style={{ color: MUTED }}>Lexical points: </span>{s.lexicalPoints}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: SLATE }}>
                    <span style={{ color: MUTED }}>Last attendance: </span>
                    {lastPresent ? fmtDhaka(lastPresent.scheduledAt, { dateStyle: 'medium' }) : 'Never'}
                  </p>
                  {s.history.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 11, color: MUTED }}>No past classes yet.</p>
                  ) : (
                    <div style={{ overflowX: 'auto', marginTop: 4 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
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
                                {h.present ? <Check size={12} style={{ color: '#10B981' }} aria-hidden /> : <span style={{ color: MUTED }}>—</span>}
                              </td>
                              <td style={{ padding: '4px 8px', textAlign: 'center', borderBottom: `1px solid ${BORDER}` }}>
                                {h.present && h.mode === 'online' ? <Check size={12} style={{ color: '#10B981' }} aria-hidden /> : <span style={{ color: MUTED }}>—</span>}
                              </td>
                              <td style={{ padding: '4px 8px', textAlign: 'center', borderBottom: `1px solid ${BORDER}` }}>
                                {h.present && h.mode === 'offline' ? <Check size={12} style={{ color: '#10B981' }} aria-hidden /> : <span style={{ color: MUTED }}>—</span>}
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

      {error && <p style={{ fontSize: 12, color: RED, margin: 0 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <GhostBtn onClick={onClose} small>Cancel</GhostBtn>
        <PrimaryBtn onClick={handleSave} loading={saving} small>Save Attendance</PrimaryBtn>
      </div>
    </div>
  );
}

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

  const toggleChecked = async (submissionId: number, checked: boolean) => {
    setSavingId(submissionId);
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
    } finally {
      setSavingId(null);
    }
  };

  const sorted = [...rows].sort((a, b) => Number(a.checked) - Number(b.checked));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 12, color: MUTED }}>
        {rows.filter(r => r.checked).length} / {rows.length} checked off
      </p>
      <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sorted.map(r => (
          <label
            key={r.submissionId}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
              borderRadius: 8, border: `1px solid ${BORDER}`, cursor: 'pointer',
              background: r.checked ? 'rgba(16,185,129,0.06)' : '#FFFFFF',
            }}
          >
            <input
              type="checkbox"
              checked={r.checked}
              disabled={savingId === r.submissionId}
              onChange={() => void toggleChecked(r.submissionId, !r.checked)}
              style={{ width: 16, height: 16, flexShrink: 0, cursor: 'pointer' }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                margin: 0, fontSize: 13, fontWeight: 600, color: SLATE,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {r.userName}
              </p>
              <p style={{
                margin: 0, fontSize: 11, color: MUTED,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {r.assignmentTitle}
              </p>
            </div>
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <GhostBtn small onClick={() => { onRefresh(); onClose(); }}>Close</GhostBtn>
      </div>
    </div>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({ session, index, onRefresh }: {
  session: TodaySession; index: number; onRefresh: () => void;
}) {
  const [uploadOpen,   setUploadOpen]   = useState(false);
  const [hwOpen,       setHwOpen]       = useState(false);
  const [attOpen,      setAttOpen]      = useState(false);
  const [offlineOpen,  setOfflineOpen]  = useState(false);
  const [completing,   setCompleting]   = useState(false);
  const [confirmComp,  setConfirmComp]  = useState(false);
  const [toast,        setToast]        = useState<string | null>(null);

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
      <style>{SPIN_CSS}</style>
      <motion.div
        custom={index}
        variants={rowV}
        initial="hidden"
        animate="visible"
        style={{
          background: '#FFFFFF',
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: '18px 20px',
          opacity: isCancelled ? 0.55 : 1,
        }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: SLATE, letterSpacing: '-0.02em' }}>
              {session.title}
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <SubjectBadge subject={session.subject} />
              <StatusBadge status={session.status} />
              {session.batch && (
                <span style={{ fontSize: 11, color: MUTED, background: BG, border: `1px solid ${BORDER}`, padding: '2px 7px', borderRadius: 100 }}>
                  Batch {session.batch}
                </span>
              )}
            </div>
          </div>
          <div style={{ flexShrink: 0, textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: SLATE, fontVariantNumeric: 'tabular-nums' }}>
              {startTime}
            </p>
            <p style={{ margin: 0, fontSize: 11, color: MUTED }}>→ {endTime}</p>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Users size={12} style={{ color: MUTED }} aria-hidden />
            <span style={{ fontSize: 12, color: '#6B7280' }}>{session.attendanceCount} attended</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <BookOpen size={12} style={{ color: MUTED }} aria-hidden />
            <span style={{ fontSize: 12, color: '#6B7280' }}>{session.materialsCount} materials</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Clock size={12} style={{ color: MUTED }} aria-hidden />
            <span style={{ fontSize: 12, color: '#6B7280' }}>{session.durationMinutes} min</span>
          </div>
        </div>

        {/* Action buttons */}
        {!isCancelled && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {session.meetLink && (
              <a
                href={session.meetLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
              >
                <motion.div
                  whileTap={{ scale: 0.96 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 12px', borderRadius: 7,
                    background: 'rgba(16,185,129,0.09)',
                    border: '1px solid rgba(16,185,129,0.25)',
                    color: '#065F46', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <Video size={12} aria-hidden />
                  Open Meet
                  <ExternalLink size={10} aria-hidden />
                </motion.div>
              </a>
            )}

            <motion.button
              onClick={() => setAttOpen(true)}
              whileTap={{ scale: 0.96 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 7,
                background: BG, border: `1px solid ${BORDER}`,
                color: '#374151', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}
            >
              <Users size={12} aria-hidden />
              Take Attendance
            </motion.button>

            <motion.button
              onClick={() => setUploadOpen(true)}
              whileTap={{ scale: 0.96 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 7,
                background: BG, border: `1px solid ${BORDER}`,
                color: '#374151', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}
            >
              <Upload size={12} aria-hidden />
              Upload PDF
            </motion.button>

            <motion.button
              onClick={() => setHwOpen(true)}
              whileTap={{ scale: 0.96 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 7,
                background: BG, border: `1px solid ${BORDER}`,
                color: '#374151', fontSize: 12, fontWeight: 500, cursor: 'pointer',
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
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 12px', borderRadius: 7,
                    background: uncheckedCount > 0 ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.09)',
                    border: `1px solid ${uncheckedCount > 0 ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.25)'}`,
                    color: uncheckedCount > 0 ? '#92400E' : '#065F46',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
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
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 12px', borderRadius: 7,
                  background: 'rgba(214,43,56,0.05)',
                  border: '1px solid rgba(214,43,56,0.2)',
                  color: RED, fontSize: 12, fontWeight: 500,
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
      <Modal open={attOpen} onClose={() => setAttOpen(false)} title={`Attendance — ${session.title}`} width={480}>
        <AttendanceSheet
          session={session}
          onClose={() => setAttOpen(false)}
          onDone={() => { showToast('Attendance saved'); onRefresh(); }}
        />
      </Modal>

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title={`Upload PDF — ${session.title}`} width={480}>
        <UploadSheet session={session} onClose={() => setUploadOpen(false)} onDone={() => showToast('PDF uploaded')} />
      </Modal>

      <Modal open={hwOpen} onClose={() => setHwOpen(false)} title={`Post Homework — ${session.title}`} width={480}>
        <HomeworkSheet session={session} onClose={() => setHwOpen(false)} onDone={() => showToast('Homework posted')} />
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

export default function TodayClient({ initial }: Props) {
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
      <style>{SPIN_CSS}</style>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: SLATE, letterSpacing: '-0.04em', lineHeight: 1.2 }}>
            Today
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: MUTED }}>{dateLabel}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {data.assignmentsDue48h > 0 && (
            <span style={{
              padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600,
              background: 'rgba(245,158,11,0.1)', color: '#92400E',
              border: '1px solid rgba(245,158,11,0.25)',
            }}>
              {data.assignmentsDue48h} homework due in 48h
            </span>
          )}
          <motion.button
            onClick={refresh}
            disabled={refreshing}
            whileTap={{ scale: 0.96 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 7,
              background: BG, border: `1px solid ${BORDER}`,
              color: '#374151', fontSize: 12, fontWeight: 500, cursor: 'pointer',
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
          borderRadius: 12, padding: '48px 24px', textAlign: 'center',
        }}>
          <CalendarX size={32} style={{ color: '#D1D5DB', margin: '0 auto 12px', display: 'block' }} aria-hidden />
          <p style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: SLATE }}>No class today</p>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: MUTED }}>
            No sessions scheduled for today in Dhaka time.
          </p>
          <Link href="/admin/classes" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 7, background: SLATE,
            color: '#FFFFFF', fontSize: 13, fontWeight: 600,
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
              <SessionCard key={s.id} session={s} index={i} onRefresh={refresh} />
            ))}
          </AnimatePresence>
        </div>
      )}

      <Toast message={toast} />
    </>
  );
}

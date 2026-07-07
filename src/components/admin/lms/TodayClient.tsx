'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video, Upload, BookOpen, CheckCircle, Users, Clock,
  ExternalLink, CalendarX, ChevronRight, Loader2, X,
} from 'lucide-react';
import { uploadToR2 } from '@/lib/lms/upload-client';
import {
  SubjectBadge, StatusBadge, Toast, ConfirmDialog, Modal,
  FieldLabel, FieldInput, FieldTextarea, FieldSelect, PrimaryBtn, GhostBtn,
  fmtDhaka, dhakaLocalToISO, SPIN_CSS, RED, SLATE, BORDER, MUTED, BG,
  rowV,
} from './lms-shared';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  const [batch,   setBatch]   = useState(session.batch ?? '');
  const [progress, setProgress] = useState(0);
  const [stage,   setStage]   = useState<'idle' | 'uploading' | 'saving' | 'done'>('idle');
  const [error,   setError]   = useState('');

  const handleUpload = async () => {
    if (!file || !title.trim()) { setError('Title and file are required'); return; }
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
          title: title.trim(),
          type: 'pdf',
          blobUrl: key,
          fileName: file.name,
          fileSize: file.size,
          subject: session.subject,
          product: session.product,
          batch: batch || null,
          classSessionId: session.id,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
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
        <FieldLabel>Title *</FieldLabel>
        <FieldInput
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Class Notes – Week 3"
        />
      </div>
      <div>
        <FieldLabel>Batch (leave blank for all)</FieldLabel>
        <FieldInput
          value={batch}
          onChange={e => setBatch(e.target.value)}
          placeholder="e.g. 2025"
        />
      </div>
      <div>
        <FieldLabel>PDF File *</FieldLabel>
        <input
          type="file"
          accept="application/pdf"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
          style={{ fontSize: 13, color: SLATE }}
        />
        {file && (
          <p style={{ margin: '4px 0 0', fontSize: 11, color: MUTED }}>
            {file.name} — {(file.size / 1024 / 1024).toFixed(1)} MB
          </p>
        )}
      </div>
      {stage === 'uploading' && (
        <div>
          <div style={{ background: '#F3F4F6', borderRadius: 4, height: 4 }}>
            <div style={{
              height: 4, borderRadius: 4, background: RED,
              width: `${progress}%`, transition: 'width 0.3s',
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
          disabled={!file || !title.trim() || stage !== 'idle'}
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

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({ session, index, onRefresh }: {
  session: TodaySession; index: number; onRefresh: () => void;
}) {
  const [uploadOpen,   setUploadOpen]   = useState(false);
  const [hwOpen,       setHwOpen]       = useState(false);
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
      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title={`Upload PDF — ${session.title}`} width={480}>
        <UploadSheet session={session} onClose={() => setUploadOpen(false)} onDone={() => showToast('PDF uploaded')} />
      </Modal>

      <Modal open={hwOpen} onClose={() => setHwOpen(false)} title={`Post Homework — ${session.title}`} width={480}>
        <HomeworkSheet session={session} onClose={() => setHwOpen(false)} onDone={() => showToast('Homework posted')} />
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

'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Edit2, Trash2, Calendar, Zap, RefreshCw, ChevronRight, ExternalLink,
  CheckCircle, FileText, Upload, X as XIcon, BookMarked, ChevronDown, AlertCircle,
} from 'lucide-react';
import {
  SubjectBadge, StatusBadge, Toast, ConfirmDialog, Modal, TabBar, Toggle,
  FieldLabel, FieldInput, FieldTextarea, FieldSelect, PrimaryBtn, GhostBtn,
  IconBtn, EmptyState, PageHeader,
  fmtDhaka, dhakaLocalToISO, epochToDhakaLocal,
  SPIN_CSS, RED, SLATE, BORDER, MUTED, BG, rowV,
  titleCase, extractPdfHeading,
} from './lms-shared';
import { uploadToR2 } from '@/lib/lms/upload-client';
import { trackFeature } from '@/lib/analytics/tracker';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClassSession {
  id: number;
  scheduleId: number | null;
  title: string;
  description: string | null;
  subject: string;
  product: string;
  batch: string | null;
  scheduledAt: number;
  durationMinutes: number;
  status: string;
  meetLink: string | null;
  googleEventId: string | null;
  recallBotId: string | null;
  createdBy: number;
  createdAt: number;
}

export interface ClassSchedule {
  id: number;
  titleTemplate: string;
  subject: string;
  product: string;
  batch: string | null;
  dayOfWeek: number;
  timeOfDay: string;
  durationMinutes: number;
  active: boolean;
  createdBy: number;
  createdAt: number;
}

interface Props {
  initialSessions: ClassSession[];
  initialSchedules: ClassSchedule[];
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SUBJECTS = ['english', 'math', 'analytical'];
const STATUSES = ['draft', 'scheduled', 'live', 'completed', 'cancelled'];

// Predict next class number based on existing sessions
function predictNextClassName(sessions: ClassSession[], subject: string): string | null {
  const subjectSessions = sessions.filter(s => s.subject === subject);
  if (subjectSessions.length === 0) return null;

  const classRegex = new RegExp(`${subject}\\s+class\\s+(\\d+)`, 'i');
  const numbers = subjectSessions
    .map(s => {
      const match = s.title.match(classRegex);
      return match ? parseInt(match[1], 10) : null;
    })
    .filter((n): n is number => n !== null)
    .sort((a, b) => b - a);

  if (numbers.length === 0) return null;
  const nextNum = numbers[0] + 1;
  return `${subject.charAt(0).toUpperCase() + subject.slice(1)} Class ${nextNum}`;
}

// ─── Session Form ─────────────────────────────────────────────────────────────

interface SessionForm {
  title: string; description: string; subject: string; product: string;
  batch: string; scheduledAt: string; durationMinutes: string;
  meetLink: string; status: string;
}

const defaultSessionForm: SessionForm = {
  title: '', description: '', subject: 'english', product: 'iba',
  batch: '', scheduledAt: '', durationMinutes: '90', meetLink: '', status: 'scheduled',
};

function SessionModal({
  open, editing, onClose, onSaved, allSessions = [],
}: {
  open: boolean; editing: ClassSession | null;
  onClose: () => void; onSaved: (s: ClassSession) => void;
  allSessions?: ClassSession[];
}) {
  const [form, setForm] = useState<SessionForm>(() => editing ? {
    title: editing.title,
    description: editing.description ?? '',
    subject: editing.subject,
    product: editing.product,
    batch: editing.batch ?? '',
    scheduledAt: epochToDhakaLocal(editing.scheduledAt),
    durationMinutes: String(editing.durationMinutes),
    meetLink: editing.meetLink ?? '',
    status: editing.status,
  } : defaultSessionForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showMore, setShowMore] = useState(Boolean(editing));
  const [extracting, setExtracting] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Resync form state whenever the modal opens — it's mounted once and
  // reused for every session, so `editing` can change without a remount.
  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      title: editing.title,
      description: editing.description ?? '',
      subject: editing.subject,
      product: editing.product,
      batch: editing.batch ?? '',
      scheduledAt: epochToDhakaLocal(editing.scheduledAt),
      durationMinutes: String(editing.durationMinutes),
      meetLink: editing.meetLink ?? '',
      status: editing.status,
    } : defaultSessionForm);
    setShowMore(Boolean(editing));
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const predictedName = !editing ? predictNextClassName(allSessions, form.subject) : null;

  const f = (k: keyof SessionForm, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExtracting(true);
    setError('');
    try {
      const heading = await extractPdfHeading(file);
      if (heading) {
        f('title', heading);
      } else {
        setError('Could not extract title from PDF');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process PDF');
    } finally {
      setExtracting(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  const applyPredicted = () => {
    if (predictedName) f('title', predictedName);
  };

  const handleSave = async () => {
    if (!form.scheduledAt || !form.durationMinutes) {
      setError('Choose the class time and duration'); return;
    }
    setSaving(true); setError('');
    try {
      const payload = {
        title: form.title.trim() || `${form.subject.charAt(0).toUpperCase() + form.subject.slice(1)} Class`,
        description: form.description.trim() || null,
        subject: form.subject,
        product: form.product,
        batch: form.batch.trim() || null,
        scheduledAt: dhakaLocalToISO(form.scheduledAt),
        durationMinutes: Number(form.durationMinutes),
        meetLink: form.meetLink.trim() || null,
        status: form.status,
      };
      const url    = editing ? `/api/lms/admin/classes/${editing.id}` : '/api/lms/admin/classes';
      const method = editing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json() as { error?: string }; throw new Error(e.error ?? 'Failed'); }
      const saved = await res.json() as ClassSession;
      trackFeature(editing ? 'class_updated' : 'class_created', 'lms', {
        classSessionId: saved.id,
        subject: saved.subject,
        product: saved.product,
      });
      onSaved(saved); onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Session' : 'New Session'} width={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {showMore && <div>
          <FieldLabel>Class title</FieldLabel>
          <FieldInput value={form.title} onChange={e => f('title', e.target.value)} placeholder="Optional — e.g. English Class" />
          {!editing && (predictedName || !form.title) && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {predictedName && (
                <button
                  type="button"
                  onClick={applyPredicted}
                  style={{
                    padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                    border: `1px solid ${BORDER}`, background: '#FFFFFF', color: '#374151',
                    fontWeight: 500,
                  }}
                >
                  ✓ Use "{predictedName}"
                </button>
              )}
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                disabled={extracting}
                style={{
                  padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: extracting ? 'not-allowed' : 'pointer',
                  border: `1px solid ${BORDER}`, background: '#FFFFFF', color: '#374151',
                  fontWeight: 500, opacity: extracting ? 0.6 : 1,
                }}
              >
                {extracting ? '⟳ Reading PDF…' : '📄 From PDF'}
              </button>
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf"
                style={{ display: 'none' }}
                onChange={handlePdfUpload}
              />
            </div>
          )}
        </div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <FieldLabel>Subject *</FieldLabel>
            <FieldSelect value={form.subject} onChange={e => f('subject', e.target.value)}>
              {SUBJECTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </FieldSelect>
          </div>
          <div>
            <FieldLabel>Product *</FieldLabel>
            <FieldSelect value={form.product} onChange={e => f('product', e.target.value)}>
              <option value="iba">IBA</option>
              <option value="fbs">FBS</option>
              <option value="fbs_detailed">FBS Detailed</option>
            </FieldSelect>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <FieldLabel>Batch (blank = all)</FieldLabel>
            <FieldInput value={form.batch} onChange={e => f('batch', e.target.value)} placeholder="e.g. 2025" />
          </div>
          {showMore && <div>
            <FieldLabel>Status</FieldLabel>
            <FieldSelect value={form.status} onChange={e => f('status', e.target.value)}>
              {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </FieldSelect>
          </div>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <FieldLabel>Date & Time (Dhaka) *</FieldLabel>
            <FieldInput type="datetime-local" value={form.scheduledAt} onChange={e => f('scheduledAt', e.target.value)} />
          </div>
          <div>
            <FieldLabel>Duration (min) *</FieldLabel>
            <FieldInput type="number" min="15" value={form.durationMinutes} onChange={e => f('durationMinutes', e.target.value)} />
          </div>
        </div>
        {showMore && <div>
          <FieldLabel>Description</FieldLabel>
          <FieldTextarea value={form.description} onChange={e => f('description', e.target.value)} placeholder="Optional description" rows={3} />
        </div>}
        {showMore && <div>
          <FieldLabel>Meet Link (optional)</FieldLabel>
          <FieldInput value={form.meetLink} onChange={e => f('meetLink', e.target.value)} placeholder="https://meet.google.com/..." />
        </div>}
        {!editing && (
          <button
            type="button"
            onClick={() => setShowMore((value) => !value)}
            aria-expanded={showMore}
            style={{ minHeight: 44, alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 0', border: 0, background: 'transparent', color: '#760F13', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            <ChevronDown size={16} aria-hidden style={{ transform: showMore ? 'rotate(180deg)' : 'none', transition: 'transform 160ms ease' }} />
            {showMore ? 'Hide optional details' : 'Add title, description, status, or Meet link'}
          </button>
        )}
        {error && <p style={{ fontSize: 12, color: RED, margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <GhostBtn onClick={onClose} small>Cancel</GhostBtn>
          <PrimaryBtn onClick={handleSave} loading={saving} small>{editing ? 'Save Changes' : 'Create Session'}</PrimaryBtn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Schedule Form ────────────────────────────────────────────────────────────

interface ScheduleForm {
  titleTemplate: string; subject: string; product: string;
  batch: string; dayOfWeek: string; timeOfDay: string;
  durationMinutes: string; active: boolean;
}

const defaultScheduleForm: ScheduleForm = {
  titleTemplate: '', subject: 'english', product: 'iba',
  batch: '', dayOfWeek: '0', timeOfDay: '10:00',
  durationMinutes: '90', active: true,
};

function ScheduleModal({
  open, editing, onClose, onSaved,
}: {
  open: boolean; editing: ClassSchedule | null;
  onClose: () => void; onSaved: (s: ClassSchedule) => void;
}) {
  const [form, setForm] = useState<ScheduleForm>(() => editing ? {
    titleTemplate: editing.titleTemplate,
    subject: editing.subject,
    product: editing.product,
    batch: editing.batch ?? '',
    dayOfWeek: String(editing.dayOfWeek),
    timeOfDay: editing.timeOfDay,
    durationMinutes: String(editing.durationMinutes),
    active: editing.active,
  } : defaultScheduleForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Resync form state whenever the modal opens — see SessionModal for why.
  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      titleTemplate: editing.titleTemplate,
      subject: editing.subject,
      product: editing.product,
      batch: editing.batch ?? '',
      dayOfWeek: String(editing.dayOfWeek),
      timeOfDay: editing.timeOfDay,
      durationMinutes: String(editing.durationMinutes),
      active: editing.active,
    } : defaultScheduleForm);
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const f = (k: keyof ScheduleForm, v: string | boolean) =>
    setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.titleTemplate.trim()) { setError('Title template is required'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        titleTemplate: form.titleTemplate.trim(),
        subject: form.subject,
        product: form.product,
        batch: form.batch.trim() || null,
        dayOfWeek: Number(form.dayOfWeek),
        timeOfDay: form.timeOfDay,
        durationMinutes: Number(form.durationMinutes),
        active: form.active,
      };
      const url    = editing ? `/api/lms/admin/schedules/${editing.id}` : '/api/lms/admin/schedules';
      const method = editing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json() as { error?: string }; throw new Error(e.error ?? 'Failed'); }
      const saved = await res.json() as ClassSchedule;
      onSaved(saved); onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Schedule Rule' : 'New Schedule Rule'} width={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <FieldLabel>Title Template *</FieldLabel>
          <FieldInput value={form.titleTemplate} onChange={e => f('titleTemplate', e.target.value)} placeholder="e.g. English Class – Week {n}" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <FieldLabel>Subject *</FieldLabel>
            <FieldSelect value={form.subject} onChange={e => f('subject', e.target.value)}>
              {SUBJECTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </FieldSelect>
          </div>
          <div>
            <FieldLabel>Product *</FieldLabel>
            <FieldSelect value={form.product} onChange={e => f('product', e.target.value)}>
              <option value="iba">IBA</option>
              <option value="fbs">FBS</option>
              <option value="fbs_detailed">FBS Detailed</option>
            </FieldSelect>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <FieldLabel>Day of Week</FieldLabel>
            <FieldSelect value={form.dayOfWeek} onChange={e => f('dayOfWeek', e.target.value)}>
              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </FieldSelect>
          </div>
          <div>
            <FieldLabel>Time (Dhaka)</FieldLabel>
            <FieldInput type="time" value={form.timeOfDay} onChange={e => f('timeOfDay', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <FieldLabel>Duration (min)</FieldLabel>
            <FieldInput type="number" min="15" value={form.durationMinutes} onChange={e => f('durationMinutes', e.target.value)} />
          </div>
          <div>
            <FieldLabel>Batch (blank = all)</FieldLabel>
            <FieldInput value={form.batch} onChange={e => f('batch', e.target.value)} placeholder="e.g. 2025" />
          </div>
        </div>
        <Toggle checked={form.active} onChange={v => f('active', v)} label="Active (generates sessions)" />
        {error && <p style={{ fontSize: 12, color: RED, margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <GhostBtn onClick={onClose} small>Cancel</GhostBtn>
          <PrimaryBtn onClick={handleSave} loading={saving} small>{editing ? 'Save Changes' : 'Create Rule'}</PrimaryBtn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Completed class form ─────────────────────────────────────────────────────

interface PendingFile {
  file: File;
  title: string;
  progress: number; // 0–100, -1 = error
  done: boolean;
}

interface CompletedClassForm {
  title: string;
  description: string;
  subject: string;
  product: string;
  batch: string;
  scheduledAt: string; // Dhaka datetime-local
  durationMinutes: string;
}

const defaultCompletedForm: CompletedClassForm = {
  title: '',
  description: '',
  subject: 'english',
  product: 'iba',
  batch: '',
  scheduledAt: '',
  durationMinutes: '90',
};

function CompletedClassModal({
  open, onClose, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (s: ClassSession) => void;
}) {
  const [step, setStep]       = useState<'details' | 'upload'>('details');
  const [form, setForm]       = useState<CompletedClassForm>(defaultCompletedForm);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [createdSession, setCreatedSession] = useState<ClassSession | null>(null);

  // Upload state
  const [files, setFiles]     = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const f = (k: keyof CompletedClassForm, v: string) =>
    setForm(p => ({ ...p, [k]: v }));

  // Reset when modal opens/closes
  React.useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep('details');
        setForm(defaultCompletedForm);
        setSaving(false);
        setError('');
        setCreatedSession(null);
        setFiles([]);
        setUploading(false);
        setUploadDone(false);
      }, 200);
    }
  }, [open]);

  // Step 1: create the session
  const handleCreateSession = async () => {
    if (!form.title.trim() || !form.scheduledAt || !form.durationMinutes) {
      setError('Title, date/time and duration are required'); return;
    }
    // Validate that the date is in the past (Dhaka local → check against now)
    const scheduledMs = new Date(dhakaLocalToISO(form.scheduledAt)).getTime();
    if (scheduledMs >= Date.now()) {
      setError('For a completed class the date must be in the past'); return;
    }
    setSaving(true); setError('');
    try {
      const payload = {
        title:           form.title.trim(),
        description:     form.description.trim() || null,
        subject:         form.subject,
        product:         form.product,
        batch:           form.batch.trim() || null,
        scheduledAt:     dhakaLocalToISO(form.scheduledAt),
        durationMinutes: Number(form.durationMinutes),
        meetLink:        null,
        status:          'completed',
      };
      const res = await fetch('/api/lms/admin/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const e = await res.json() as { error?: string };
        throw new Error(e.error ?? 'Failed to create session');
      }
      const created = await res.json() as ClassSession;
      setCreatedSession(created);
      setStep('upload');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  // File picker
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []).filter(f => f.type === 'application/pdf');
    if (picked.length === 0) return;
    setFiles(prev => [
      ...prev,
      ...picked.map(file => ({
        file,
        title: file.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' '),
        progress: 0,
        done: false,
      })),
    ]);
    // Reset input so the same file can be added again if needed
    e.target.value = '';
  };

  const removeFile = (idx: number) =>
    setFiles(prev => prev.filter((_, i) => i !== idx));

  const setFileTitle = (idx: number, title: string) =>
    setFiles(prev => prev.map((f, i) => i === idx ? { ...f, title } : f));

  // Step 2: upload all PDFs and create material rows
  const handleUpload = async () => {
    if (!createdSession) return;
    if (files.length === 0) {
      // No PDFs — just finish
      onSaved(createdSession);
      onClose();
      return;
    }
    setUploading(true); setError('');
    try {
      for (let i = 0; i < files.length; i++) {
        const pf = files[i];
        if (pf.done) continue;

        // Presign + upload
        const { key } = await uploadToR2({
          file: pf.file,
          endpoint: '/api/lms/admin/materials/upload',
          onProgress: (pct) => {
            setFiles(prev => prev.map((f, idx) =>
              idx === i ? { ...f, progress: pct } : f,
            ));
          },
        });

        // Create material metadata row
        const matRes = await fetch('/api/lms/admin/materials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title:          pf.title.trim() || pf.file.name,
            type:           'pdf',
            blobUrl:        key,
            fileName:       pf.file.name,
            fileSize:       pf.file.size,
            subject:        createdSession.subject,
            product:        createdSession.product,
            batch:          createdSession.batch ?? null,
            classSessionId: createdSession.id,
          }),
        });
        if (!matRes.ok) {
          const e = await matRes.json() as { error?: string };
          throw new Error(`Material save failed: ${e.error ?? 'unknown'}`);
        }

        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, progress: 100, done: true } : f,
        ));
      }

      // Auto-append the PDF cover heading to the class title (e.g.
      // "English Class 1" → "English Class 1 – Foundation Grammar Skills")
      try {
        const heading = await extractPdfHeading(files[0].file);
        if (heading) {
          const titled = titleCase(heading);
          if (!createdSession.title.toLowerCase().includes(titled.toLowerCase())) {
            const newTitle = `${createdSession.title} – ${titled}`;
            const patchRes = await fetch(`/api/lms/admin/classes/${createdSession.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title: newTitle }),
            });
            if (patchRes.ok) {
              const updated = await patchRes.json() as ClassSession;
              setCreatedSession(updated);
            }
          }
        }
      } catch {
        // Non-fatal — heading extraction/title update is a nice-to-have
      }

      setUploadDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
      // Mark failed files
      setFiles(prev => prev.map(f => f.done ? f : { ...f, progress: -1 }));
    } finally {
      setUploading(false);
    }
  };

  const handleFinish = () => {
    if (createdSession) onSaved(createdSession);
    onClose();
  };

  // Max date for the datetime-local input (now in Dhaka time)
  const dhakaMaxNow = (() => {
    const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
    const dhakaMs = Date.now() + DHAKA_OFFSET_MS;
    const d = new Date(dhakaMs);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  })();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={step === 'details' ? 'Log Completed Class' : 'Attach Lecture Sheets'}
      width={560}
    >
      {step === 'details' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Step indicator */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 8,
            background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)',
          }}>
            <CheckCircle size={14} style={{ color: '#10B981', flexShrink: 0 }} aria-hidden />
            <span style={{ fontSize: 12, color: '#065F46', fontWeight: 500 }}>
              Step 1 of 2 — Class details. You can attach PDFs in the next step.
            </span>
          </div>

          <div>
            <FieldLabel>Title *</FieldLabel>
            <FieldInput
              value={form.title}
              onChange={e => f('title', e.target.value)}
              placeholder="e.g. English Class – Week 4"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <FieldLabel>Subject *</FieldLabel>
              <FieldSelect value={form.subject} onChange={e => f('subject', e.target.value)}>
                {SUBJECTS.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </FieldSelect>
            </div>
            <div>
              <FieldLabel>Product *</FieldLabel>
              <FieldSelect value={form.product} onChange={e => f('product', e.target.value)}>
                <option value="iba">IBA</option>
                <option value="fbs">FBS</option>
                <option value="fbs_detailed">FBS Detailed</option>
              </FieldSelect>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div>
              <FieldLabel>Date & Time (Dhaka) — must be past *</FieldLabel>
              <FieldInput
                type="datetime-local"
                value={form.scheduledAt}
                onChange={e => f('scheduledAt', e.target.value)}
                max={dhakaMaxNow}
              />
            </div>
            <div>
              <FieldLabel>Duration (min) *</FieldLabel>
              <FieldInput
                type="number"
                min="15"
                value={form.durationMinutes}
                onChange={e => f('durationMinutes', e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <FieldLabel>Batch (blank = all)</FieldLabel>
              <FieldInput
                value={form.batch}
                onChange={e => f('batch', e.target.value)}
                placeholder="e.g. 2025"
              />
            </div>
          </div>

          <div>
            <FieldLabel>Description (optional)</FieldLabel>
            <FieldTextarea
              value={form.description}
              onChange={e => f('description', e.target.value)}
              placeholder="Topics covered, notes…"
              rows={3}
            />
          </div>

          {error && <p style={{ fontSize: 12, color: RED, margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <GhostBtn onClick={onClose} small>Cancel</GhostBtn>
            <PrimaryBtn onClick={handleCreateSession} loading={saving} small>
              Next: Attach PDFs
            </PrimaryBtn>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Step indicator */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 8,
            background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)',
          }}>
            <CheckCircle size={14} style={{ color: '#10B981', flexShrink: 0 }} aria-hidden />
            <span style={{ fontSize: 12, color: '#065F46', fontWeight: 500 }}>
              Step 2 of 2 — Class saved. Attach lecture-sheet PDFs (optional).
            </span>
          </div>

          {/* Session summary */}
          {createdSession && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: BG, border: `1px solid ${BORDER}`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <BookMarked size={14} style={{ color: MUTED, flexShrink: 0 }} aria-hidden />
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: SLATE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {createdSession.title}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: MUTED }}>
                  {fmtDhaka(createdSession.scheduledAt)} · {createdSession.durationMinutes} min · completed
                </p>
              </div>
            </div>
          )}

          {/* File drop zone */}
          {!uploadDone && (
            <>
              <div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  style={{
                    width: '100%', padding: '20px', borderRadius: 10,
                    border: `2px dashed ${BORDER}`, background: BG,
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    opacity: uploading ? 0.6 : 1,
                  }}
                >
                  <Upload size={22} style={{ color: MUTED }} aria-hidden />
                  <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
                    Click to select PDF files
                  </span>
                  <span style={{ fontSize: 11, color: MUTED }}>
                    PDF only · multiple files allowed
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {files.map((pf, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '10px 12px', borderRadius: 8,
                        border: `1px solid ${pf.progress === -1 ? 'rgba(214,43,56,0.3)' : BORDER}`,
                        background: pf.progress === -1 ? 'rgba(214,43,56,0.04)' : '#FFFFFF',
                        display: 'flex', flexDirection: 'column', gap: 6,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FileText size={13} style={{ color: MUTED, flexShrink: 0 }} aria-hidden />
                        <input
                          value={pf.title}
                          onChange={e => setFileTitle(idx, e.target.value)}
                          disabled={uploading || pf.done}
                          placeholder="Material title"
                          style={{
                            flex: 1, border: 'none', outline: 'none',
                            fontSize: 12, fontWeight: 500, color: SLATE,
                            background: 'transparent',
                          }}
                        />
                        {!uploading && !pf.done && (
                          <button
                            type="button"
                            onClick={() => removeFile(idx)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: MUTED, padding: 2, display: 'flex', alignItems: 'center',
                            }}
                            aria-label="Remove file"
                          >
                            <XIcon size={13} aria-hidden />
                          </button>
                        )}
                        {pf.done && (
                          <CheckCircle size={13} style={{ color: '#10B981', flexShrink: 0 }} aria-hidden />
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
                        {pf.file.name} · {(pf.file.size / 1024).toFixed(0)} KB
                      </p>
                      {pf.progress > 0 && !pf.done && pf.progress !== -1 && (
                        <div style={{ height: 3, background: '#E5E7EB', borderRadius: 2 }}>
                          <div style={{
                            height: '100%', borderRadius: 2,
                            background: RED,
                            width: '100%',
                            transform: `scaleX(${pf.progress / 100})`,
                            transformOrigin: 'left',
                            transition: 'transform 0.1s',
                          }} />
                        </div>
                      )}
                      {pf.progress === -1 && (
                        <p style={{ margin: 0, fontSize: 11, color: RED }}>Upload failed</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {uploadDone && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 16px', borderRadius: 8,
              background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)',
            }}>
              <CheckCircle size={18} style={{ color: '#10B981', flexShrink: 0 }} aria-hidden />
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#065F46' }}>
                  {files.length} PDF{files.length !== 1 ? 's' : ''} uploaded successfully
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#059669' }}>
                  Lecture sheets are now attached to this class.
                </p>
              </div>
            </div>
          )}

          {error && <p style={{ fontSize: 12, color: RED, margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {!uploadDone ? (
              <>
                <GhostBtn onClick={handleFinish} small disabled={uploading}>
                  Skip — finish without PDFs
                </GhostBtn>
                {files.length > 0 && (
                  <PrimaryBtn onClick={handleUpload} loading={uploading} small>
                    <Upload size={12} aria-hidden />
                    Upload {files.length} PDF{files.length !== 1 ? 's' : ''}
                  </PrimaryBtn>
                )}
              </>
            ) : (
              <PrimaryBtn onClick={handleFinish} small>
                Done
              </PrimaryBtn>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Sessions tab ─────────────────────────────────────────────────────────────

function SessionsTab({ sessions }: { sessions: ClassSession[] }) {
  const [modalOpen,         setModalOpen]         = useState(false);
  const [completedOpen,     setCompletedOpen]     = useState(false);
  const [editing,           setEditing]           = useState<ClassSession | null>(null);
  const [deleteId,          setDeleteId]          = useState<number | null>(null);
  const [deleting,          setDeleting]          = useState(false);
  const [toast,             setToast]             = useState<string | null>(null);
  const [statusFilter,      setStatusFilter]      = useState('all');
  const [subjectFilter,     setSubjectFilter]     = useState('all');
  const [localSessions,     setLocalSessions]     = useState(sessions);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  const filtered = localSessions.filter(s => {
    if (statusFilter  !== 'all' && s.status  !== statusFilter)  return false;
    if (subjectFilter !== 'all' && s.subject !== subjectFilter) return false;
    return true;
  });

  const handleSaved = (saved: ClassSession) => {
    setLocalSessions(prev => {
      const idx = prev.findIndex(s => s.id === saved.id);
      return idx >= 0 ? prev.map(s => s.id === saved.id ? saved : s) : [saved, ...prev];
    });
    showToast(editing ? 'Session updated' : 'Session created');
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/lms/admin/classes/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { deleted: boolean; cancelled: boolean };
      if (data.cancelled) {
        setLocalSessions(prev => prev.map(s => s.id === deleteId ? { ...s, status: 'cancelled' } : s));
        showToast('Session cancelled (has records)');
      } else {
        setLocalSessions(prev => prev.filter(s => s.id !== deleteId));
        showToast('Session deleted');
      }
    } catch {
      showToast('Delete failed');
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <>
      <style>{SPIN_CSS}</style>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* Status filter chips */}
          {['all', ...STATUSES].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: '5px 12px', borderRadius: 100, fontSize: 12, cursor: 'pointer',
              fontWeight: statusFilter === s ? 600 : 400,
              border: `1.5px solid ${statusFilter === s ? RED : BORDER}`,
              background: statusFilter === s ? 'rgba(214,43,56,0.05)' : '#FFFFFF',
              color: statusFilter === s ? RED : '#6B7280',
            }}>{s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}</button>
          ))}
          {/* Subject filter */}
          <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)} style={{
            padding: '5px 28px 5px 10px', borderRadius: 100, fontSize: 12, cursor: 'pointer',
            border: `1.5px solid ${BORDER}`, background: '#FFFFFF', color: '#6B7280', outline: 'none',
          }}>
            <option value="all">All subjects</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
          <GhostBtn onClick={() => setCompletedOpen(true)} small>
            <CheckCircle size={13} aria-hidden />
            Log Completed Class
          </GhostBtn>
          <PrimaryBtn onClick={() => { setEditing(null); setModalOpen(true); }} small>
            <Plus size={13} aria-hidden />
            New Session
          </PrimaryBtn>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState icon={Calendar} message="No sessions match the selected filters." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((s, i) => (
            <motion.div
              key={s.id}
              custom={i} variants={rowV} initial="hidden" animate="visible"
              style={{
                background: '#FFFFFF', border: `1px solid ${BORDER}`,
                borderRadius: 10, padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
                opacity: s.status === 'cancelled' ? 0.55 : 1,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: SLATE }}>{s.title}</p>
                  <SubjectBadge subject={s.subject} />
                  <StatusBadge status={s.status} />
                  {s.batch && <span style={{ fontSize: 11, color: MUTED }}>Batch {s.batch}</span>}
                </div>
                <p style={{ margin: 0, fontSize: 12, color: MUTED }}>
                  {fmtDhaka(s.scheduledAt)} · {s.durationMinutes} min
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                <Link
                  href={`/admin/classes/${s.id}`}
                  title="View detail"
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28, borderRadius: 6, border: `1px solid ${BORDER}`,
                    background: '#FFFFFF', color: '#6B7280', flexShrink: 0,
                    textDecoration: 'none',
                  }}
                  aria-label="View class detail"
                >
                  <ExternalLink size={13} aria-hidden />
                </Link>
                <IconBtn icon={Edit2} label="Edit" onClick={() => { setEditing(s); setModalOpen(true); }} />
                <IconBtn icon={Trash2} label="Delete" danger onClick={() => setDeleteId(s.id)} />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <SessionModal
        open={modalOpen}
        editing={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSaved={handleSaved}
        allSessions={localSessions}
      />
      <CompletedClassModal
        open={completedOpen}
        onClose={() => setCompletedOpen(false)}
        onSaved={(saved) => {
          setLocalSessions(prev => [saved, ...prev]);
          showToast('Completed class logged');
        }}
      />
      <ConfirmDialog
        open={!!deleteId} title="Delete this session?"
        message="If the session has attendance or recording records it will be cancelled instead."
        confirmLabel="Delete / Cancel" destructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
      <Toast message={toast} />
    </>
  );
}

// ─── Schedules tab ────────────────────────────────────────────────────────────

function SchedulesTab({ schedules }: { schedules: ClassSchedule[] }) {
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editing,     setEditing]     = useState<ClassSchedule | null>(null);
  const [deleteId,    setDeleteId]    = useState<number | null>(null);
  const [deleting,    setDeleting]    = useState(false);
  const [generating,  setGenerating]  = useState(false);
  const [toast,       setToast]       = useState<string | null>(null);
  const [localList,   setLocalList]   = useState(schedules);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500); };

  const handleSaved = (saved: ClassSchedule) => {
    setLocalList(prev => {
      const idx = prev.findIndex(s => s.id === saved.id);
      return idx >= 0 ? prev.map(s => s.id === saved.id ? saved : s) : [saved, ...prev];
    });
    showToast(editing ? 'Schedule updated' : 'Schedule created');
    setEditing(null);
  };

  const handleToggleActive = async (sc: ClassSchedule) => {
    try {
      const res = await fetch(`/api/lms/admin/schedules/${sc.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !sc.active }),
      });
      if (!res.ok) throw new Error('Failed');
      const updated = await res.json() as ClassSchedule;
      setLocalList(prev => prev.map(s => s.id === updated.id ? updated : s));
    } catch {
      showToast('Update failed');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/lms/admin/schedules/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      setLocalList(prev => prev.filter(s => s.id !== deleteId));
      showToast('Schedule deleted');
    } catch {
      showToast('Delete failed');
    } finally {
      setDeleting(false); setDeleteId(null);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/lms/admin/classes/generate', { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { created: number };
      showToast(`Generated ${data.created} session${data.created !== 1 ? 's' : ''}`);
    } catch {
      showToast('Generate failed');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <style>{SPIN_CSS}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <GhostBtn onClick={handleGenerate} disabled={generating} small>
          {generating
            ? <><RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} aria-hidden /> Generating…</>
            : <><Zap size={12} aria-hidden /> Generate Sessions (14 days)</>}
        </GhostBtn>
        <PrimaryBtn onClick={() => { setEditing(null); setModalOpen(true); }} small>
          <Plus size={13} aria-hidden />
          New Rule
        </PrimaryBtn>
      </div>

      {localList.length === 0 ? (
        <EmptyState icon={Calendar} message="No recurring schedules. Create a rule to auto-generate sessions." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {localList.map((sc, i) => (
            <motion.div
              key={sc.id}
              custom={i} variants={rowV} initial="hidden" animate="visible"
              style={{
                background: '#FFFFFF', border: `1px solid ${BORDER}`,
                borderRadius: 10, padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
                opacity: sc.active ? 1 : 0.55,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: SLATE }}>{sc.titleTemplate}</p>
                  <SubjectBadge subject={sc.subject} />
                  {!sc.active && (
                    <span style={{ fontSize: 11, color: MUTED, background: '#F3F4F6', padding: '2px 7px', borderRadius: 100 }}>Paused</span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: 12, color: MUTED }}>
                  {DAYS[sc.dayOfWeek]} at {sc.timeOfDay} Dhaka · {sc.durationMinutes} min
                  {sc.batch ? ` · Batch ${sc.batch}` : ' · All batches'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                <Toggle checked={sc.active} onChange={() => void handleToggleActive(sc)} label="" />
                <IconBtn icon={Edit2} label="Edit" onClick={() => { setEditing(sc); setModalOpen(true); }} />
                <IconBtn icon={Trash2} label="Delete" danger onClick={() => setDeleteId(sc.id)} />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <ScheduleModal
        open={modalOpen}
        editing={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSaved={handleSaved}
      />
      <ConfirmDialog
        open={!!deleteId} title="Delete this schedule rule?"
        message="Future generated sessions will not be affected."
        confirmLabel="Delete" destructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
      <Toast message={toast} />
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ClassesClient({ initialSessions, initialSchedules }: Props) {
  const [tab, setTab] = useState<'sessions' | 'schedules'>('sessions');

  return (
    <>
      <PageHeader
        title="Classes"
        subtitle="Manage class sessions and recurring schedule rules"
        action={
          <a href="/admin/today" style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '7px 14px', borderRadius: 7, background: BG,
            border: `1px solid ${BORDER}`, color: '#374151',
            fontSize: 12, fontWeight: 500, textDecoration: 'none',
          }}>
            Today's console <ChevronRight size={12} aria-hidden />
          </a>
        }
      />
      <TabBar
        tabs={[{ id: 'sessions', label: 'Sessions' }, { id: 'schedules', label: 'Weekly Schedule' }]}
        active={tab}
        onChange={(id) => setTab(id as 'sessions' | 'schedules')}
      />
      <AnimatePresence mode="wait">
        {tab === 'sessions'
          ? <SessionsTab key="sessions" sessions={initialSessions} />
          : <SchedulesTab key="schedules" schedules={initialSchedules} />
        }
      </AnimatePresence>
    </>
  );
}

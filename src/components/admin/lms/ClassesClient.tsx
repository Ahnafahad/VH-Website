'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Edit2, Trash2, Calendar, Zap, RefreshCw, ChevronRight, ExternalLink,
} from 'lucide-react';
import {
  SubjectBadge, StatusBadge, Toast, ConfirmDialog, Modal, TabBar, Toggle,
  FieldLabel, FieldInput, FieldTextarea, FieldSelect, PrimaryBtn, GhostBtn,
  DangerBtn, IconBtn, EmptyState, PageHeader,
  fmtDhaka, dhakaLocalToISO, epochToDhakaLocal,
  SPIN_CSS, RED, SLATE, BORDER, MUTED, BG, rowV,
} from './lms-shared';

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
  open, editing, onClose, onSaved,
}: {
  open: boolean; editing: ClassSession | null;
  onClose: () => void; onSaved: (s: ClassSession) => void;
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

  const f = (k: keyof SessionForm, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim() || !form.scheduledAt || !form.durationMinutes) {
      setError('Title, scheduled time and duration are required'); return;
    }
    setSaving(true); setError('');
    try {
      const payload = {
        title: form.title.trim(),
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
        <div>
          <FieldLabel>Title *</FieldLabel>
          <FieldInput value={form.title} onChange={e => f('title', e.target.value)} placeholder="Session title" />
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
            <FieldLabel>Batch (blank = all)</FieldLabel>
            <FieldInput value={form.batch} onChange={e => f('batch', e.target.value)} placeholder="e.g. 2025" />
          </div>
          <div>
            <FieldLabel>Status</FieldLabel>
            <FieldSelect value={form.status} onChange={e => f('status', e.target.value)}>
              {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </FieldSelect>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <div>
            <FieldLabel>Date & Time (Dhaka) *</FieldLabel>
            <FieldInput type="datetime-local" value={form.scheduledAt} onChange={e => f('scheduledAt', e.target.value)} />
          </div>
          <div>
            <FieldLabel>Duration (min) *</FieldLabel>
            <FieldInput type="number" min="15" value={form.durationMinutes} onChange={e => f('durationMinutes', e.target.value)} />
          </div>
        </div>
        <div>
          <FieldLabel>Description</FieldLabel>
          <FieldTextarea value={form.description} onChange={e => f('description', e.target.value)} placeholder="Optional description" rows={3} />
        </div>
        <div>
          <FieldLabel>Meet Link (optional)</FieldLabel>
          <FieldInput value={form.meetLink} onChange={e => f('meetLink', e.target.value)} placeholder="https://meet.google.com/..." />
        </div>
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

// ─── Sessions tab ─────────────────────────────────────────────────────────────

function SessionsTab({ sessions, onRefresh }: {
  sessions: ClassSession[]; onRefresh: () => void;
}) {
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editing,     setEditing]     = useState<ClassSession | null>(null);
  const [deleteId,    setDeleteId]    = useState<number | null>(null);
  const [deleting,    setDeleting]    = useState(false);
  const [toast,       setToast]       = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [localSessions, setLocalSessions] = useState(sessions);

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
        <PrimaryBtn onClick={() => { setEditing(null); setModalOpen(true); }} small>
          <Plus size={13} aria-hidden />
          New Session
        </PrimaryBtn>
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
          ? <SessionsTab key="sessions" sessions={initialSessions} onRefresh={() => {}} />
          : <SchedulesTab key="schedules" schedules={initialSchedules} />
        }
      </AnimatePresence>
    </>
  );
}

'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Trash2, Edit2, Plus, AlertCircle, Clock, ChevronDown, ChevronUp, FileText, CheckCircle, Send, Loader2 } from 'lucide-react';
import {
  SubjectBadge, Toast, ConfirmDialog, Modal,
  FieldLabel, FieldInput, FieldTextarea, FieldSelect, PrimaryBtn, GhostBtn,
  IconBtn, EmptyState, PageHeader,
  fmtDhaka, dhakaLocalToISO, epochToDhakaLocal,
  SPIN_CSS, RED, SLATE, BORDER, MUTED, BG, rowV,
} from './lms-shared';
import type { ClassSession } from './ClassesClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Assignment {
  id: number;
  title: string;
  description: string;
  attachmentUrl: string | null;
  subject: string;
  product: string;
  batch: string | null;
  classSessionId: number | null;
  dueAt: number;
  createdBy: number;
  createdAt: number;
}

interface Props {
  initialAssignments: Assignment[];
  sessions: ClassSession[];
}

const SUBJECTS = ['english', 'math', 'analytical'];

// ─── Due date chip ────────────────────────────────────────────────────────────

function DueChip({ epochMs }: { epochMs: number }) {
  const now = Date.now();
  const diff = epochMs - now;
  const overdue = diff < 0;
  const hours = Math.abs(diff) / 3600000;
  const days  = Math.floor(Math.abs(diff) / 86400000);

  let label: string;
  if (overdue) {
    label = days > 0 ? `${days}d overdue` : `${Math.round(hours)}h overdue`;
  } else if (diff < 24 * 3600000) {
    label = `Due in ${Math.round(hours)}h`;
  } else {
    label = `Due in ${days}d`;
  }

  const bg     = overdue ? 'rgba(239,68,68,0.08)'     : diff < 86400000 ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.08)';
  const color  = overdue ? '#B91C1C'                   : diff < 86400000 ? '#92400E'              : '#065F46';
  const border = overdue ? 'rgba(239,68,68,0.2)'       : diff < 86400000 ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.2)';

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 100,
      fontSize: 11, fontWeight: 600, lineHeight: 1.6,
      background: bg, color, border: `1px solid ${border}`,
    }}>
      {overdue ? <AlertCircle size={10} aria-hidden /> : <Clock size={10} aria-hidden />}
      {label}
    </span>
  );
}

// ─── Assignment form ──────────────────────────────────────────────────────────

interface AssignmentForm {
  title: string; description: string; subject: string; product: string;
  batch: string; classSessionId: string; dueAt: string; attachmentUrl: string;
}

const defaultForm: AssignmentForm = {
  title: '', description: '', subject: 'english', product: 'iba',
  batch: '', classSessionId: '', dueAt: '', attachmentUrl: '',
};

function AssignmentModal({
  open, editing, sessions, onClose, onSaved,
}: {
  open: boolean; editing: Assignment | null;
  sessions: ClassSession[];
  onClose: () => void; onSaved: (a: Assignment) => void;
}) {
  const [form, setForm] = useState<AssignmentForm>(() => editing ? {
    title: editing.title,
    description: editing.description,
    subject: editing.subject,
    product: editing.product,
    batch: editing.batch ?? '',
    classSessionId: editing.classSessionId ? String(editing.classSessionId) : '',
    dueAt: epochToDhakaLocal(editing.dueAt),
    attachmentUrl: editing.attachmentUrl ?? '',
  } : defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const f = (k: keyof AssignmentForm, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim() || !form.description.trim() || !form.dueAt) {
      setError('Title, instructions and due date are required'); return;
    }
    setSaving(true); setError('');
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        subject: form.subject,
        product: form.product,
        batch: form.batch.trim() || null,
        classSessionId: form.classSessionId ? Number(form.classSessionId) : null,
        dueAt: dhakaLocalToISO(form.dueAt),
        attachmentUrl: form.attachmentUrl.trim() || null,
      };
      const url    = editing ? `/api/lms/admin/assignments/${editing.id}` : '/api/lms/admin/assignments';
      const method = editing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json() as { error?: string }; throw new Error(e.error ?? 'Failed'); }
      const saved = await res.json() as Assignment;
      onSaved(saved); onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Assignment' : 'New Assignment'} width={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <FieldLabel>Title *</FieldLabel>
          <FieldInput value={form.title} onChange={e => f('title', e.target.value)} placeholder="Assignment title" />
        </div>
        <div>
          <FieldLabel>Instructions *</FieldLabel>
          <FieldTextarea value={form.description} onChange={e => f('description', e.target.value)}
            placeholder="Describe what students need to do…" rows={4} />
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
            <FieldLabel>Link to Class (optional)</FieldLabel>
            <FieldSelect value={form.classSessionId} onChange={e => f('classSessionId', e.target.value)}>
              <option value="">— none —</option>
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.title} ({fmtDhaka(s.scheduledAt, { dateStyle: 'short' })})
                </option>
              ))}
            </FieldSelect>
          </div>
        </div>
        <div>
          <FieldLabel>Due Date & Time (Dhaka) *</FieldLabel>
          <FieldInput type="datetime-local" value={form.dueAt} onChange={e => f('dueAt', e.target.value)} />
        </div>
        <div>
          <FieldLabel>Attachment URL (optional)</FieldLabel>
          <FieldInput
            value={form.attachmentUrl}
            onChange={e => f('attachmentUrl', e.target.value)}
            type="url"
            placeholder="https://…"
          />
        </div>
        {error && <p style={{ fontSize: 12, color: RED, margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <GhostBtn onClick={onClose} small>Cancel</GhostBtn>
          <PrimaryBtn onClick={handleSave} loading={saving} small>
            {editing ? 'Save Changes' : 'Create Assignment'}
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Submission types ─────────────────────────────────────────────────────────

interface SubmissionRow {
  id: number | null;
  userId: number;
  name: string;
  email: string;
  batch: string | null;
  status: 'pending' | 'submitted' | 'reviewed';
  fileUrl: string | null;
  note: string | null;
  instructorComment: string | null;
  submittedAt: number | null;
  reviewedAt: number | null;
}

interface SubmissionsData {
  assignment: { id: number; title: string; dueAt: number };
  submissions: SubmissionRow[];
}

// ─── Submissions panel ────────────────────────────────────────────────────────

function SubmissionsPanel({ assignmentId, onClose }: { assignmentId: number; onClose: () => void }) {
  const [data, setData] = useState<SubmissionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewing, setReviewing] = useState<number | null>(null); // submissionId
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch(`/api/lms/admin/assignments/${assignmentId}/submissions`)
      .then(r => r.json())
      .then((d: SubmissionsData) => { if (mounted) { setData(d); setLoading(false); } })
      .catch(() => { if (mounted) { setError('Failed to load submissions'); setLoading(false); } });
    return () => { mounted = false; };
  }, [assignmentId]);

  const handleReview = useCallback(async (submissionId: number) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/lms/admin/submissions/${submissionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructorComment: comment.trim() || undefined }),
      });
      if (!res.ok) throw new Error('Failed');
      const updated = await res.json() as SubmissionRow;
      setData(prev => prev ? {
        ...prev,
        submissions: prev.submissions.map(s =>
          s.id === submissionId ? { ...s, ...updated, status: 'reviewed' } : s,
        ),
      } : prev);
      setReviewing(null);
      setComment('');
      showToast('Marked as reviewed');
    } catch {
      showToast('Failed to save review');
    } finally {
      setSaving(false);
    }
  }, [comment]);

  const statusColor = (status: string) => {
    if (status === 'reviewed') return { bg: 'rgba(16,185,129,0.08)', color: '#065F46', border: 'rgba(16,185,129,0.2)' };
    if (status === 'submitted') return { bg: 'rgba(245,158,11,0.1)', color: '#92400E', border: 'rgba(245,158,11,0.25)' };
    return { bg: '#F3F4F6', color: '#6B7280', border: BORDER };
  };

  return (
    <div style={{
      background: '#FAFAFA', border: `1px solid ${BORDER}`,
      borderRadius: 10, padding: '20px', marginTop: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: SLATE }}>Submissions</p>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 12 }}>
          Close
        </button>
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: MUTED, textAlign: 'center', padding: '24px 0' }}>Loading…</p>
      ) : error ? (
        <p style={{ fontSize: 13, color: RED, textAlign: 'center', padding: '24px 0' }}>{error}</p>
      ) : !data || data.submissions.length === 0 ? (
        <p style={{ fontSize: 13, color: MUTED, textAlign: 'center', padding: '24px 0' }}>No students in scope.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.submissions.map((sub) => {
            const sc = statusColor(sub.status);
            const isReviewOpen = reviewing === sub.id;
            return (
              <div key={sub.userId} style={{ background: '#FFFFFF', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: SLATE }}>{sub.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: MUTED }}>{sub.email}{sub.batch ? ` · Batch ${sub.batch}` : ''}</p>
                  </div>
                  <span style={{
                    padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 600,
                    background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, textTransform: 'capitalize',
                  }}>
                    {sub.status}
                  </span>
                </div>

                {sub.status !== 'pending' && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {sub.fileUrl && (
                      <a href={sub.fileUrl} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#3B82F6' }}>
                        <FileText size={12} aria-hidden /> View submitted file
                      </a>
                    )}
                    {sub.note && (
                      <p style={{ margin: 0, fontSize: 12, color: '#374151', background: BG, padding: '6px 10px', borderRadius: 6, border: `1px solid ${BORDER}` }}>
                        Note: {sub.note}
                      </p>
                    )}
                    {sub.instructorComment && (
                      <p style={{ margin: 0, fontSize: 12, color: '#374151', borderLeft: `2px solid ${RED}`, paddingLeft: 8 }}>
                        Feedback: {sub.instructorComment}
                      </p>
                    )}
                    {sub.status === 'submitted' && sub.id !== null && (
                      <>
                        <button
                          onClick={() => setReviewing(isReviewOpen ? null : sub.id)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            fontSize: 12, fontWeight: 500, color: SLATE,
                            background: 'none', border: `1px solid ${BORDER}`, borderRadius: 6,
                            padding: '5px 10px', cursor: 'pointer', marginTop: 4, width: 'fit-content',
                          }}
                        >
                          <CheckCircle size={12} aria-hidden />
                          Mark Reviewed
                          {isReviewOpen ? <ChevronUp size={11} aria-hidden /> : <ChevronDown size={11} aria-hidden />}
                        </button>
                        {isReviewOpen && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                            <textarea
                              value={comment}
                              onChange={e => setComment(e.target.value)}
                              placeholder="Instructor comment (optional)"
                              rows={3}
                              style={{
                                width: '100%', boxSizing: 'border-box',
                                padding: '8px 10px', borderRadius: 6,
                                border: `1.5px solid ${BORDER}`, fontSize: 12, color: SLATE,
                                outline: 'none', resize: 'vertical',
                              }}
                            />
                            <div style={{ display: 'flex', gap: 6 }}>
                              <GhostBtn small onClick={() => { setReviewing(null); setComment(''); }}>Cancel</GhostBtn>
                              <PrimaryBtn small onClick={() => { if (sub.id !== null) void handleReview(sub.id); }} loading={saving}>
                                <Send size={11} aria-hidden /> Save Review
                              </PrimaryBtn>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, padding: '10px 20px', borderRadius: 8,
          background: SLATE, color: '#FFF', fontSize: 13, fontWeight: 500,
          boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function HomeworkClient({ initialAssignments, sessions }: Props) {
  const [assignments, setAssignments] = useState(initialAssignments);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [expandedSubmissions, setExpandedSubmissions] = useState<number | null>(null);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  const filtered = assignments.filter(a =>
    subjectFilter === 'all' || a.subject === subjectFilter,
  );

  const handleSaved = (saved: Assignment) => {
    setAssignments(prev => {
      const idx = prev.findIndex(a => a.id === saved.id);
      return idx >= 0 ? prev.map(a => a.id === saved.id ? saved : a) : [saved, ...prev];
    });
    showToast(editing ? 'Assignment updated' : 'Assignment created');
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/lms/admin/assignments/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      setAssignments(prev => prev.filter(a => a.id !== deleteId));
      showToast('Deleted');
    } catch {
      showToast('Delete failed');
    } finally {
      setDeleting(false); setDeleteId(null);
    }
  };

  const sessionMap = new Map(sessions.map(s => [s.id, s]));

  return (
    <>
      <style>{SPIN_CSS}</style>
      <PageHeader
        title="Homework"
        subtitle={`${assignments.length} assignment${assignments.length !== 1 ? 's' : ''}`}
        action={
          <PrimaryBtn onClick={() => { setEditing(null); setModalOpen(true); }} small>
            <Plus size={13} aria-hidden />
            New Assignment
          </PrimaryBtn>
        }
      />

      {/* Subject filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['all', ...SUBJECTS].map(s => (
          <button key={s} onClick={() => setSubjectFilter(s)} style={{
            padding: '5px 12px', borderRadius: 100, fontSize: 12, cursor: 'pointer',
            fontWeight: subjectFilter === s ? 600 : 400,
            border: `1.5px solid ${subjectFilter === s ? RED : BORDER}`,
            background: subjectFilter === s ? 'rgba(214,43,56,0.05)' : '#FFFFFF',
            color: subjectFilter === s ? RED : '#6B7280',
          }}>
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState icon={BookOpen} message="No assignments match the filter." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((a, i) => (
            <motion.div
              key={a.id}
              custom={i} variants={rowV} initial="hidden" animate="visible"
              style={{
                background: '#FFFFFF', border: `1px solid ${BORDER}`,
                borderRadius: 10, padding: '14px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: SLATE }}>{a.title}</p>
                    <SubjectBadge subject={a.subject} />
                    <DueChip epochMs={a.dueAt} />
                    {a.batch && (
                      <span style={{ fontSize: 11, color: MUTED, background: BG, border: `1px solid ${BORDER}`, padding: '2px 7px', borderRadius: 100 }}>
                        Batch {a.batch}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '0 0 4px', fontSize: 12, color: '#6B7280', lineHeight: 1.4,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                    {a.description}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
                    Due {fmtDhaka(a.dueAt)}
                    {a.classSessionId ? ` · ${sessionMap.get(a.classSessionId)?.title ?? 'Class #' + a.classSessionId}` : ''}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => setExpandedSubmissions(expandedSubmissions === a.id ? null : a.id)}
                    title="View submissions"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                      border: `1px solid ${expandedSubmissions === a.id ? RED : BORDER}`,
                      background: expandedSubmissions === a.id ? 'rgba(214,43,56,0.05)' : '#FFF',
                      color: expandedSubmissions === a.id ? RED : '#6B7280', cursor: 'pointer',
                    }}
                  >
                    {expandedSubmissions === a.id ? <ChevronUp size={11} aria-hidden /> : <ChevronDown size={11} aria-hidden />}
                    Submissions
                  </button>
                  <IconBtn icon={Edit2} label="Edit" onClick={() => { setEditing(a); setModalOpen(true); }} />
                  <IconBtn icon={Trash2} label="Delete" danger onClick={() => setDeleteId(a.id)} />
                </div>
              </div>
              {expandedSubmissions === a.id && (
                <SubmissionsPanel assignmentId={a.id} onClose={() => setExpandedSubmissions(null)} />
              )}
            </motion.div>
          ))}
        </div>
      )}

      <AssignmentModal
        open={modalOpen}
        editing={editing}
        sessions={sessions}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSaved={handleSaved}
      />
      <ConfirmDialog
        open={!!deleteId} title="Delete this assignment?"
        message="Students will no longer see this assignment."
        confirmLabel="Delete" destructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
      <Toast message={toast} />
    </>
  );
}

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BookOpen, Trash2, Edit2, Plus, AlertCircle, Clock, FileText, CheckCircle, Loader2, Upload, X as XIcon } from 'lucide-react';
import { uploadToR2 } from '@/lib/lms/upload-client';
import {
  Toast, ConfirmDialog, Modal,
  FieldLabel, FieldInput, FieldTextarea, FieldSelect, PrimaryBtn, GhostBtn,
  IconBtn, EmptyState, PageHeader, FormActions,
  fmtDhaka, dhakaLocalToISO, epochToDhakaLocal, titleCase,
  SPIN_CSS, RED, SLATE, BORDER, MUTED, BG,
  RED_HOVER, SURFACE, SURFACE_ALT,
  OK, OK_BG, WARN, WARN_BG, INFO,
  R_SM, R_MD, R_LG, R_PILL,
  FONT_HEADING, T_XS, T_SM, T_BASE,
} from './lms-shared';
import type { ClassSession } from './ClassesClient';
import { useAdminProduct } from '@/components/admin/AdminProductContext';
import {
  Drawer, MonthGroup, Toolbar, ToolbarSpacer, SearchBox, FilterChip, CountTabs, KIT_CSS,
  groupByMonth, initialOpenMonths, currentMonthKey, homeworkStatus, submissionShape,
  type HomeworkStatus, type SubmissionShape,
} from './kit';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Assignment {
  id: number;
  title: string;
  description: string;
  attachmentUrl: string | null;
  materialId: number | null;
  solutionMaterialId: number | null;
  subject: string;
  product: string;
  batch: string | null;
  classSessionId: number | null;
  dueAt: number;
  createdBy: number;
  createdAt: number;
  // Added by GET /api/lms/admin/assignments (absent on POST/PATCH rows).
  submittedCount?: number;
  reviewedCount?: number;
  scopeCount?: number;
}

export interface MaterialOption {
  id: number;
  title: string;
  type: string;
  fileName: string | null;
  fileSize: number | null;
  subject: string;
  createdAt: number;
}

export interface BatchOption {
  id: number;
  name: string;
  product: string;
  status: string;
}

interface Props {
  initialAssignments: Assignment[];
  sessions: ClassSession[];
  allMaterials: MaterialOption[];
  batches: BatchOption[];
}

const SUBJECTS = ['english', 'math', 'analytical', 'accounting', 'economics', 'business_studies'];

// ─── Local styles (hover / focus-visible — inline style props can't express
//     pseudo-classes, so this scoped stylesheet fills that gap using the same
//     imported tokens as everything else in this file) ────────────────────────

const HW_LOCAL_STYLES = `
  .hw-pill { transition: background-color .15s, color .15s, border-color .15s; }
  .hw-pill:hover:not(:disabled) { filter: brightness(0.97); }
  .hw-link { transition: color .15s; }
  .hw-link:hover:not(:disabled) { color: ${RED_HOVER}; }
  .hw-btn-primary:hover:not(:disabled) { background: ${RED_HOVER}; }
  .hw-row:hover:not(:disabled) { background: ${SURFACE_ALT}; }
  .hw-pill:focus-visible, .hw-link:focus-visible, .hw-btn-primary:focus-visible,
  .hw-row:focus-visible, .hw-input:focus-visible, .hw-mark-btn:focus-visible,
  .hw-file-link:focus-visible {
    outline: 2px solid ${RED}; outline-offset: 2px;
  }
  .hw-mark-btn:hover:not(:disabled) { filter: brightness(0.96); }
`;

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

  const bg     = overdue ? `${RED}14`     : diff < 86400000 ? WARN_BG            : OK_BG;
  const color  = overdue ? RED             : diff < 86400000 ? WARN               : OK;
  const border = overdue ? `${RED}33`     : diff < 86400000 ? `${WARN}40`        : `${OK}33`;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: R_PILL,
      fontSize: T_XS, fontWeight: 600, lineHeight: 1.6,
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
  batch: string; classSessionId: string; dueAt: string;
  materialId: string; // '' = none, or numeric string
  solutionMaterialId: string; // '' = none, or numeric string
}

const defaultForm: AssignmentForm = {
  title: '', description: '', subject: 'english', product: 'iba',
  batch: '', classSessionId: '', dueAt: '', materialId: '', solutionMaterialId: '',
};

function assignmentFormFromEditing(editing: Assignment): AssignmentForm {
  return {
    title: editing.title,
    description: editing.description,
    subject: editing.subject,
    product: editing.product,
    batch: editing.batch ?? '',
    classSessionId: editing.classSessionId ? String(editing.classSessionId) : '',
    dueAt: epochToDhakaLocal(editing.dueAt),
    materialId: editing.materialId ? String(editing.materialId) : '',
    solutionMaterialId: editing.solutionMaterialId ? String(editing.solutionMaterialId) : '',
  };
}

function AssignmentModal({
  open, editing, sessions, allMaterials, batches, defaultProduct, onClose, onSaved,
}: {
  open: boolean; editing: Assignment | null;
  sessions: ClassSession[];
  allMaterials: MaterialOption[];
  batches: BatchOption[];
  defaultProduct: string;
  onClose: () => void; onSaved: (a: Assignment) => void;
}) {
  const [form, setForm] = useState<AssignmentForm>(() => editing ? assignmentFormFromEditing(editing) : { ...defaultForm, product: defaultProduct });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [solutionUploadFile, setSolutionUploadFile] = useState<File | null>(null);
  const [solutionUploading, setSolutionUploading] = useState(false);
  const [solutionUploadProgress, setSolutionUploadProgress] = useState(0);
  const solutionFileRef = useRef<HTMLInputElement>(null);

  // Resync form state whenever the modal opens — it's mounted once and reused
  // for every assignment, so `editing` can change without a remount (same fix
  // as ClassesClient's SessionModal).
  useEffect(() => {
    if (!open) return;
    setForm(editing ? assignmentFormFromEditing(editing) : { ...defaultForm, product: defaultProduct });
    setError('');
    setUploadFile(null);
    setUploadProgress(0);
    setSolutionUploadFile(null);
    setSolutionUploadProgress(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const f = (k: keyof AssignmentForm, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleUploadPdf = async () => {
    if (!uploadFile) return;
    setUploading(true); setError('');
    try {
      const { key } = await uploadToR2({
        file: uploadFile,
        endpoint: '/api/lms/admin/materials/upload',
        onProgress: setUploadProgress,
      });
      const matRes = await fetch('/api/lms/admin/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: uploadFile.name.replace(/\.pdf$/i, ''),
          type: 'pdf',
          blobUrl: key,
          fileName: uploadFile.name,
          fileSize: uploadFile.size,
          subject: form.subject,
          product: form.product,
          batch: form.batch.trim() || null,
        }),
      });
      if (!matRes.ok) throw new Error('Material save failed');
      const newMat = await matRes.json() as MaterialOption;
      allMaterials.push(newMat); // mutate for this session
      setForm(p => ({ ...p, materialId: String(newMat.id) }));
      setUploadFile(null);
      setUploadProgress(0);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadSolutionPdf = async () => {
    if (!solutionUploadFile) return;
    setSolutionUploading(true); setError('');
    try {
      const { key } = await uploadToR2({
        file: solutionUploadFile,
        endpoint: '/api/lms/admin/materials/upload',
        onProgress: setSolutionUploadProgress,
      });
      const matRes = await fetch('/api/lms/admin/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${solutionUploadFile.name.replace(/\.pdf$/i, '')} (Solution)`,
          type: 'pdf',
          blobUrl: key,
          fileName: solutionUploadFile.name,
          fileSize: solutionUploadFile.size,
          subject: form.subject,
          product: form.product,
          batch: form.batch.trim() || null,
        }),
      });
      if (!matRes.ok) throw new Error('Material save failed');
      const newMat = await matRes.json() as MaterialOption;
      allMaterials.push(newMat); // mutate for this session
      setForm(p => ({ ...p, solutionMaterialId: String(newMat.id) }));
      setSolutionUploadFile(null);
      setSolutionUploadProgress(0);
      if (solutionFileRef.current) solutionFileRef.current.value = '';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setSolutionUploading(false);
    }
  };

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
        materialId: form.materialId ? Number(form.materialId) : null,
        solutionMaterialId: form.solutionMaterialId ? Number(form.solutionMaterialId) : null,
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
            <FieldSelect value={form.batch} onChange={e => f('batch', e.target.value)}>
              <option value="">All batches</option>
              {batches.filter(b => b.product === form.product).map(b => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </FieldSelect>
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
          <FieldLabel>PDF Attachment (optional)</FieldLabel>
          {/* Pick existing */}
          <FieldSelect value={form.materialId} onChange={e => f('materialId', e.target.value)}>
            <option value="">— none —</option>
            {allMaterials.map(m => (
              <option key={m.id} value={String(m.id)}>
                {m.title}{m.fileSize ? ` (${(m.fileSize / 1_000_000).toFixed(1)} MB)` : ''}
              </option>
            ))}
          </FieldSelect>
          {/* Or upload new */}
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 6,
              fontSize: T_SM, color: MUTED, border: `1px dashed ${BORDER}`,
              borderRadius: R_MD, padding: '6px 10px', cursor: 'pointer',
            }}>
              <FileText size={13} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {uploadFile ? uploadFile.name : 'Upload new PDF…'}
              </span>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                style={{ display: 'none' }}
                onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {uploadFile && (
              <button
                type="button"
                onClick={() => void handleUploadPdf()}
                disabled={uploading}
                className="hw-btn-primary"
                style={{
                  fontSize: T_SM, fontWeight: 600, padding: '6px 12px', borderRadius: R_MD,
                  background: RED, color: SURFACE, border: 'none', cursor: uploading ? 'not-allowed' : 'pointer',
                  opacity: uploading ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                {uploading ? (
                  <><Loader2 size={12} className="animate-spin" />  {uploadProgress < 100 ? `${uploadProgress}%` : 'Saving…'}</>
                ) : (
                  <><Upload size={12} /> Upload</>
                )}
              </button>
            )}
          </div>
          {form.materialId && (
            <p style={{ fontSize: T_XS, color: OK, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle size={11} /> PDF attached: {allMaterials.find(m => String(m.id) === form.materialId)?.title ?? `Material #${form.materialId}`}
              <button
                type="button"
                onClick={() => f('materialId', '')}
                style={{ marginLeft: 4, background: 'none', border: 'none', cursor: 'pointer', color: MUTED, padding: 0 }}
                aria-label="Clear attachment"
              >
                <XIcon size={11} />
              </button>
            </p>
          )}
        </div>
        <div>
          <FieldLabel>Solution PDF (optional)</FieldLabel>
          <p style={{ fontSize: T_XS, color: MUTED, margin: '0 0 6px' }}>
            Students unlock this the moment they submit or choose to show their work offline.
          </p>
          {/* Pick existing */}
          <FieldSelect value={form.solutionMaterialId} onChange={e => f('solutionMaterialId', e.target.value)}>
            <option value="">— none —</option>
            {allMaterials.map(m => (
              <option key={m.id} value={String(m.id)}>
                {m.title}{m.fileSize ? ` (${(m.fileSize / 1_000_000).toFixed(1)} MB)` : ''}
              </option>
            ))}
          </FieldSelect>
          {/* Or upload new */}
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 6,
              fontSize: T_SM, color: MUTED, border: `1px dashed ${BORDER}`,
              borderRadius: R_MD, padding: '6px 10px', cursor: 'pointer',
            }}>
              <FileText size={13} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {solutionUploadFile ? solutionUploadFile.name : 'Upload new PDF…'}
              </span>
              <input
                ref={solutionFileRef}
                type="file"
                accept=".pdf"
                style={{ display: 'none' }}
                onChange={e => setSolutionUploadFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {solutionUploadFile && (
              <button
                type="button"
                onClick={() => void handleUploadSolutionPdf()}
                disabled={solutionUploading}
                className="hw-btn-primary"
                style={{
                  fontSize: T_SM, fontWeight: 600, padding: '6px 12px', borderRadius: R_MD,
                  background: RED, color: SURFACE, border: 'none', cursor: solutionUploading ? 'not-allowed' : 'pointer',
                  opacity: solutionUploading ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                {solutionUploading ? (
                  <><Loader2 size={12} className="animate-spin" />  {solutionUploadProgress < 100 ? `${solutionUploadProgress}%` : 'Saving…'}</>
                ) : (
                  <><Upload size={12} /> Upload</>
                )}
              </button>
            )}
          </div>
          {form.solutionMaterialId && (
            <p style={{ fontSize: T_XS, color: OK, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle size={11} /> Solution attached: {allMaterials.find(m => String(m.id) === form.solutionMaterialId)?.title ?? `Material #${form.solutionMaterialId}`}
              <button
                type="button"
                onClick={() => f('solutionMaterialId', '')}
                style={{ marginLeft: 4, background: 'none', border: 'none', cursor: 'pointer', color: MUTED, padding: 0 }}
                aria-label="Clear solution"
              >
                <XIcon size={11} />
              </button>
            </p>
          )}
        </div>
        {error && <p style={{ fontSize: T_SM, color: RED, margin: 0 }}>{error}</p>}
        <FormActions>
          <GhostBtn onClick={onClose} small>Cancel</GhostBtn>
          <PrimaryBtn onClick={handleSave} loading={saving} small>
            {editing ? 'Save Changes' : 'Create Assignment'}
          </PrimaryBtn>
        </FormActions>
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
  mode: 'file' | 'offline' | null;
  offlineChecked: boolean;
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

// ─── Submissions / marking panel ───────────────────────────────────────────────
//
// Batch marking, rebuilt per D:\VH Website\.claude\scratch\homework-marking-ux-spec.md.
// One assignment, many students, reviewed in one sitting. There are no marks or
// scores anywhere here — a submission is reviewed or it isn't, and the row
// button toggles between the two so a mis-click is undoable.
//
// Design constraints:
//  - Never leave this panel to review a student (no per-row modal, no separate page).
//  - Keyboard-first: Enter in a row's note field marks it reviewed AND
//    auto-focuses the next not-yet-reviewed row's button. Enter always means
//    "reviewed, next"; un-reviewing is a deliberate click and does not advance.
//  - Dense rows: no avatar/ID/timestamp/email/mode metadata — just status dot,
//    name, an optional file link, an optional note field, and the toggle.
//  - Autosave per row via POST /api/lms/admin/submissions/[id] with
//    { reviewed, instructorComment }. No terminal Save button. Failures show
//    inline on the row with a Retry action.
//  - Sticky "N of M reviewed" header inside the panel's own scroll area, so
//    position stays obvious while scrolling a long roster.
//
// The count only covers students who actually submitted — the API has no
// endpoint to act on a 'pending' (not-yet-submitted) row, so those are shown
// for context (dim, non-interactive) but excluded from the N/M count.

function SubmissionsPanel({ assignmentId, onClose, embedded = false, onCounts }: {
  assignmentId: number; onClose: () => void;
  /** Rendered inside a Drawer: drop the card chrome, the Close button and the own scroll area. */
  embedded?: boolean;
  /** Reports reviewed / submitted totals whenever they change. */
  onCounts?: (reviewed: number, submitted: number) => void;
}) {
  const [data, setData] = useState<SubmissionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [rowState, setRowState] = useState<Record<number, 'saving' | 'error'>>({});
  const [rowError, setRowError] = useState<Record<number, string>>({});
  const [focusTargetId, setFocusTargetId] = useState<number | null>(null);
  const buttonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch(`/api/lms/admin/assignments/${assignmentId}/submissions`)
      .then(async r => {
        // An error response still parses as JSON ({ error }), and storing that
        // shape as `data` crashes the render below on `data.submissions`.
        const body = await r.json().catch(() => null);
        if (!r.ok || !Array.isArray(body?.submissions)) throw new Error('bad response');
        return body as SubmissionsData;
      })
      .then((d: SubmissionsData) => {
        if (!mounted) return;
        setData(d);
        setLoading(false);
        const first = d.submissions.find(s => s.status === 'submitted' && s.id !== null);
        if (first?.id != null) setFocusTargetId(first.id);
      })
      .catch(() => { if (mounted) { setError('Failed to load submissions'); setLoading(false); } });
    return () => { mounted = false; };
  }, [assignmentId]);

  React.useEffect(() => {
    if (focusTargetId !== null) {
      buttonRefs.current.get(focusTargetId)?.focus();
      setFocusTargetId(null);
    }
  }, [focusTargetId]);

  const handleSetReviewed = useCallback(async (sub: SubmissionRow, reviewed: boolean) => {
    if (sub.id === null || !data) return;
    const submissionId = sub.id;
    const idx = data.submissions.findIndex(s => s.id === submissionId);
    setRowState(s => ({ ...s, [submissionId]: 'saving' }));
    setRowError(e => { const { [submissionId]: _drop, ...rest } = e; return rest; });
    try {
      const res = await fetch(`/api/lms/admin/submissions/${submissionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewed, instructorComment: (commentDrafts[submissionId] ?? sub.instructorComment ?? '').trim() || undefined }),
      });
      if (!res.ok) throw new Error('Failed');
      const updated = await res.json() as SubmissionRow;
      setData(prev => prev ? {
        ...prev,
        submissions: prev.submissions.map(s =>
          s.id === submissionId ? { ...s, ...updated } : s,
        ),
      } : prev);
      setRowState(s => { const { [submissionId]: _drop, ...rest } = s; return rest; });
      // Only advance when reviewing. Un-reviewing means the owner is fixing that
      // row, so focus stays put.
      if (reviewed) {
        const next = data.submissions.slice(idx + 1).find(s => s.status === 'submitted' && s.id !== null);
        setFocusTargetId(next?.id ?? null);
      }
    } catch {
      setRowState(s => ({ ...s, [submissionId]: 'error' }));
      setRowError(e => ({ ...e, [submissionId]: 'Save failed' }));
    }
  }, [data, commentDrafts]);

  const submittedTotal = data ? data.submissions.filter(s => s.status !== 'pending').length : 0;
  const reviewedTotal = data ? data.submissions.filter(s => s.status === 'reviewed').length : 0;
  const pendingTotal = data ? data.submissions.filter(s => s.status === 'pending').length : 0;
  const allMarked = submittedTotal > 0 && reviewedTotal === submittedTotal;

  const onCountsRef = useRef(onCounts);
  onCountsRef.current = onCounts;
  React.useEffect(() => {
    if (data) onCountsRef.current?.(reviewedTotal, submittedTotal);
  }, [data, reviewedTotal, submittedTotal]);

  return (
    <div style={embedded ? {
      background: BG, margin: -16, minHeight: 'calc(100% + 32px)',
    } : {
      background: BG, border: `1px solid ${BORDER}`,
      borderRadius: R_LG, marginTop: 8, maxHeight: '70vh', overflowY: 'auto',
    }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 1, background: BG,
        padding: '14px 16px 10px', borderBottom: `1px solid ${BORDER}`,
        borderTopLeftRadius: R_LG, borderTopRightRadius: R_LG,
      }}>
        {!embedded && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <p style={{ margin: 0, fontFamily: FONT_HEADING, fontSize: T_BASE, fontWeight: 700, color: SLATE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {data?.assignment.title ?? 'Submissions'}
            </p>
            <button onClick={onClose} className="hw-link" style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: T_SM, flexShrink: 0, minHeight: 44, padding: '0 4px' }}>
              Close
            </button>
          </div>
        )}
        {submittedTotal > 0 && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: T_SM, fontWeight: 700, color: allMarked ? OK : SLATE, whiteSpace: 'nowrap' }}>
              {reviewedTotal} of {submittedTotal} reviewed
            </span>
            <div style={{ flex: 1, height: 6, minWidth: 60, borderRadius: R_PILL, background: BORDER, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(reviewedTotal / submittedTotal) * 100}%`, background: OK, borderRadius: R_PILL }} />
            </div>
            {pendingTotal > 0 && (
              <span style={{ fontSize: T_XS, color: MUTED, whiteSpace: 'nowrap' }}>{pendingTotal} not submitted</span>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: '10px 16px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {loading ? (
          <p style={{ fontSize: T_BASE, color: MUTED, textAlign: 'center', padding: '24px 0' }}>Loading…</p>
        ) : error ? (
          <p style={{ fontSize: T_BASE, color: RED, textAlign: 'center', padding: '24px 0' }}>{error}</p>
        ) : !data || data.submissions.length === 0 ? (
          <p style={{ fontSize: T_BASE, color: MUTED, textAlign: 'center', padding: '24px 0' }}>No students in scope.</p>
        ) : (
          data.submissions.map((sub) => {
            if (sub.status === 'pending' || sub.id === null) {
              return (
                <div key={sub.userId} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', borderRadius: R_MD,
                  background: SURFACE_ALT, border: `1px dashed ${BORDER}`, opacity: 0.7,
                }}>
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: BORDER, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: T_BASE, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sub.name}
                  </span>
                  <span style={{ fontSize: T_XS, color: MUTED, flexShrink: 0 }}>Not submitted</span>
                </div>
              );
            }

            const submissionId = sub.id;
            const isReviewed = sub.status === 'reviewed';
            const saving = rowState[submissionId] === 'saving';
            const err = rowError[submissionId];

            return (
              <div key={sub.userId} style={{
                display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                padding: '8px 10px', borderRadius: R_MD,
                background: isReviewed ? SURFACE : WARN_BG,
                border: `1px solid ${isReviewed ? BORDER : `${WARN}4D`}`,
              }}>
                <span aria-hidden style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: isReviewed ? OK : WARN,
                }} />
                <span title={sub.name} style={{
                  flex: '0 1 140px', minWidth: 80, fontSize: T_BASE, fontWeight: 600, color: SLATE,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {sub.name}
                </span>
                {sub.fileUrl && (
                  <a href={sub.fileUrl} target="_blank" rel="noopener noreferrer" title="View submitted file"
                    className="hw-file-link"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: R_SM, flexShrink: 0, color: INFO }}>
                    <FileText size={15} aria-hidden />
                  </a>
                )}
                <input
                  value={commentDrafts[submissionId] ?? sub.instructorComment ?? ''}
                  onChange={e => setCommentDrafts(prev => ({ ...prev, [submissionId]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleSetReviewed(sub, true); } }}
                  placeholder="Note (optional)"
                  disabled={saving}
                  className="hw-input"
                  style={{
                    flex: '1 1 120px', minWidth: 100, boxSizing: 'border-box', height: 40,
                    padding: '0 10px', borderRadius: R_SM, border: `1px solid ${BORDER}`,
                    fontSize: T_SM, color: SLATE, outline: 'none',
                  }}
                />
                <button
                  ref={el => { if (el) buttonRefs.current.set(submissionId, el); else buttonRefs.current.delete(submissionId); }}
                  onClick={() => void handleSetReviewed(sub, !isReviewed)}
                  disabled={saving}
                  aria-label={isReviewed ? `Mark ${sub.name} not reviewed` : `Mark ${sub.name} reviewed`}
                  title={isReviewed ? 'Reviewed — click to undo' : 'Mark reviewed'}
                  className="hw-mark-btn"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    minWidth: 44, height: 44, padding: '0 12px', borderRadius: R_MD, flexShrink: 0,
                    border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                    background: isReviewed ? OK_BG : RED,
                    color: isReviewed ? OK : SURFACE,
                    fontSize: T_SM, fontWeight: 600, opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <CheckCircle size={15} aria-hidden />}
                  {isReviewed ? 'Reviewed' : 'Mark'}
                </button>
                {sub.note && (
                  <span style={{ flexBasis: '100%', fontSize: T_XS, color: MUTED, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_SM, padding: '4px 8px' }}>
                    {sub.note}
                  </span>
                )}
                {err && (
                  <span style={{ flexBasis: '100%', display: 'flex', alignItems: 'center', gap: 6, fontSize: T_XS, color: RED }}>
                    <AlertCircle size={11} aria-hidden /> {err}
                    <button
                      onClick={() => void handleSetReviewed(sub, !isReviewed)}
                      className="hw-link"
                      style={{ fontSize: T_XS, fontWeight: 600, color: RED, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                    >
                      Retry
                    </button>
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const STATUS_TABS: { id: HomeworkStatus; label: string }[] = [
  { id: 'review', label: 'To review' },
  { id: 'open', label: 'Open' },
  { id: 'closed', label: 'Closed' },
];

function SubmissionBar({ shape }: { shape: SubmissionShape }) {
  const t = Math.max(shape.total, 1);
  return (
    <span
      role="img"
      aria-label={`${shape.reviewed} reviewed, ${shape.waiting} waiting, ${shape.missing} missing`}
      style={{
        display: 'flex', height: 6, width: 110, flexShrink: 0, borderRadius: 3,
        overflow: 'hidden', background: SURFACE_ALT, boxShadow: `inset 0 0 0 1px ${BORDER}`,
      }}
    >
      <i style={{ display: 'block', height: '100%', width: `${(shape.reviewed / t) * 100}%`, background: OK }} />
      <i style={{ display: 'block', height: '100%', width: `${(shape.waiting / t) * 100}%`, background: INFO }} />
    </span>
  );
}

function BarLegend() {
  const swatch = (bg: string, bordered?: boolean) => (
    <i aria-hidden style={{
      display: 'inline-block', width: 22, height: 6, borderRadius: 3, background: bg,
      boxShadow: bordered ? `inset 0 0 0 1px ${BORDER}` : undefined,
    }} />
  );
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', fontSize: T_SM, color: MUTED, padding: '8px 14px', borderTop: `1px solid ${BORDER}` }}>
      <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>{swatch(OK)} reviewed</span>
      <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>{swatch(INFO)} submitted, waiting</span>
      <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>{swatch(SURFACE_ALT, true)} missing</span>
    </div>
  );
}

export default function HomeworkClient({ initialAssignments, sessions, allMaterials, batches }: Props) {
  const { product } = useAdminProduct();
  const [assignments, setAssignments] = useState(initialAssignments);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [statusTab, setStatusTab] = useState<HomeworkStatus>('review');
  const [query, setQuery] = useState('');
  const [openOverride, setOpenOverride] = useState<Record<string, boolean>>({});
  const [reviewing, setReviewing] = useState<number | null>(null);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  const inProduct = assignments.filter(a => a.product === product);
  const subjectsPresent = Array.from(new Set(inProduct.map(a => a.subject))).sort();
  const q = query.trim().toLowerCase();
  const now = Date.now();
  const scoped = inProduct.filter(a =>
    (subjectFilter === 'all' || a.subject === subjectFilter) &&
    (!q || a.title.toLowerCase().includes(q)));
  const counts: Record<HomeworkStatus, number> = { review: 0, open: 0, closed: 0 };
  for (const a of scoped) counts[homeworkStatus(a, now)]++;
  const visible = scoped.filter(a => homeworkStatus(a, now) === statusTab);
  const months = groupByMonth(visible, a => a.dueAt);
  const defaultOpen = initialOpenMonths(months.map(m => m.key));
  const isOpen = (key: string) => openOverride[`${statusTab}:${key}`] ?? (q || statusTab === 'review' ? true : defaultOpen.has(key));
  const thisMonth = currentMonthKey();
  const reviewingAssignment = reviewing != null ? assignments.find(a => a.id === reviewing) ?? null : null;

  const handleSaved = (saved: Assignment) => {
    setAssignments(prev => {
      const idx = prev.findIndex(a => a.id === saved.id);
      // POST/PATCH rows carry no submission counts: keep the ones we have.
      return idx >= 0 ? prev.map(a => a.id === saved.id ? { ...a, ...saved } : a) : [saved, ...prev];
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

  // The drawer reports live counts as rows are marked, so the list behind it
  // (and its tab counts) stay right without a refetch.
  const handleCounts = useCallback((id: number, reviewed: number, submitted: number) => {
    setAssignments(prev => prev.map(a =>
      a.id === id && (a.reviewedCount !== reviewed || a.submittedCount !== submitted)
        ? { ...a, reviewedCount: reviewed, submittedCount: submitted }
        : a));
  }, []);

  const sessionMap = new Map(sessions.map(s => [s.id, s]));

  return (
    <>
      <style>{SPIN_CSS + KIT_CSS}</style>
      <style>{HW_LOCAL_STYLES}</style>
      <PageHeader
        title="Homework"
        subtitle={`${inProduct.length} assignment${inProduct.length !== 1 ? 's' : ''}`}
      />

      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_LG, overflow: 'hidden' }}>
        <Toolbar>
          <CountTabs
            label="Homework status"
            value={statusTab}
            onChange={setStatusTab}
            tabs={STATUS_TABS.map(t => ({ ...t, count: counts[t.id], alert: t.id === 'review' }))}
          />
          <ToolbarSpacer />
          <SearchBox value={query} onChange={setQuery} placeholder="Search homework" label="Search homework" />
          <PrimaryBtn onClick={() => { setEditing(null); setModalOpen(true); }} small>
            <Plus size={13} aria-hidden />
            Post homework
          </PrimaryBtn>
        </Toolbar>
        <div role="group" aria-label="Subject" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 14px', borderBottom: `1px solid ${BORDER}` }}>
          <FilterChip pressed={subjectFilter === 'all'} onClick={() => setSubjectFilter('all')}>All</FilterChip>
          {subjectsPresent.map(s => (
            <FilterChip key={s} pressed={subjectFilter === s} onClick={() => setSubjectFilter(s)}>
              {titleCase(s.replace(/_/g, ' '))}
            </FilterChip>
          ))}
        </div>

        {months.length === 0 ? (
          <div style={{ padding: 16 }}>
            <EmptyState
              icon={BookOpen}
              message={statusTab === 'review' && !q && subjectFilter === 'all' ? 'Nothing is waiting for review.' : 'Nothing here.'}
            />
          </div>
        ) : months.map(m => (
          <MonthGroup
            key={m.key}
            label={m.label}
            open={isOpen(m.key)}
            onToggle={() => setOpenOverride(o => ({ ...o, [`${statusTab}:${m.key}`]: !isOpen(m.key) }))}
            thisMonth={m.key === thisMonth}
            summary={`${m.items.length} set`}
          >
            {m.items.map((a, i) => {
              const shape = submissionShape(a);
              const cls = a.classSessionId != null ? sessionMap.get(a.classSessionId) : undefined;
              return (
                <div
                  key={a.id}
                  className="kit-row"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', minHeight: 52, flexWrap: 'wrap',
                    borderTop: i === 0 ? 0 : `1px solid ${BORDER}`,
                  }}
                >
                  <span style={{ width: 54, flexShrink: 0, fontSize: T_SM, color: MUTED, fontFamily: 'var(--font-mono), ui-monospace, monospace' }}>
                    {fmtDhaka(a.dueAt, { day: '2-digit', month: 'short' })}
                  </span>
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: T_BASE, fontWeight: 600, color: SLATE }}>{a.title}</span>
                      {statusTab === 'open' && <DueChip epochMs={a.dueAt} />}
                    </div>
                    <div style={{ fontSize: T_XS, color: MUTED, marginTop: 2 }}>
                      {titleCase(a.subject.replace(/_/g, ' '))} · due {fmtDhaka(a.dueAt, { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' })}
                      {a.batch ? ` · Batch ${a.batch}` : ''}
                      {cls ? ` · ${cls.title}` : (a.classSessionId ? ` · Class #${a.classSessionId}` : '')}
                    </div>
                  </div>
                  <SubmissionBar shape={shape} />
                  <span className="kit-hide-sm" style={{ width: 150, fontSize: T_XS, color: MUTED, fontFamily: 'var(--font-mono), ui-monospace, monospace' }}>
                    {shape.reviewed}/{shape.reviewed + shape.waiting} reviewed
                    {shape.missing > 0 ? ` · ${shape.missing} missing` : ''}
                  </span>
                  {shape.waiting > 0 ? (
                    <PrimaryBtn small onClick={() => setReviewing(a.id)}>Review {shape.waiting}</PrimaryBtn>
                  ) : (
                    <GhostBtn small onClick={() => setReviewing(a.id)}>Open</GhostBtn>
                  )}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <IconBtn icon={Edit2} label={`Edit ${a.title}`} onClick={() => { setEditing(a); setModalOpen(true); }} />
                    <IconBtn icon={Trash2} label={`Delete ${a.title}`} danger onClick={() => setDeleteId(a.id)} />
                  </div>
                </div>
              );
            })}
          </MonthGroup>
        ))}
        <BarLegend />
      </div>

      <Drawer
        open={reviewingAssignment != null}
        onClose={() => setReviewing(null)}
        title={reviewingAssignment?.title ?? 'Submissions'}
        width={560}
      >
        {reviewingAssignment && (
          <SubmissionsPanel
            assignmentId={reviewingAssignment.id}
            onClose={() => setReviewing(null)}
            embedded
            onCounts={(reviewed, submitted) => handleCounts(reviewingAssignment.id, reviewed, submitted)}
          />
        )}
      </Drawer>

      <AssignmentModal
        open={modalOpen}
        editing={editing}
        sessions={sessions}
        allMaterials={allMaterials}
        batches={batches}
        defaultProduct={product}
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

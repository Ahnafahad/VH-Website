'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Link as LinkIcon, Trash2, Upload, ExternalLink, Plus } from 'lucide-react';
import { uploadToR2 } from '@/lib/lms/upload-client';
import {
  SubjectBadge, Toast, ConfirmDialog, Modal, TabBar,
  FieldLabel, FieldInput, FieldSelect, PrimaryBtn, GhostBtn, DangerBtn,
  IconBtn, EmptyState, PageHeader,
  fmtDhaka, SPIN_CSS, RED, SLATE, BORDER, MUTED, BG, rowV,
} from './lms-shared';
import type { ClassSession } from './ClassesClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Material {
  id: number;
  title: string;
  type: string;
  blobUrl: string;
  fileName: string | null;
  fileSize: number | null;
  subject: string;
  product: string;
  batch: string | null;
  classSessionId: number | null;
  uploadedBy: number;
  createdAt: number;
}

interface Props {
  initialMaterials: Material[];
  sessions: ClassSession[];
}

const SUBJECTS = ['english', 'math', 'analytical'];

// ─── Format file size ─────────────────────────────────────────────────────────

function fmtSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Upload PDF flow ──────────────────────────────────────────────────────────

function UploadPdfTab({
  sessions, onUploaded,
}: {
  sessions: ClassSession[]; onUploaded: (m: Material) => void;
}) {
  const [file,     setFile]     = useState<File | null>(null);
  const [title,    setTitle]    = useState('');
  const [subject,  setSubject]  = useState('english');
  const [product,  setProduct]  = useState('iba');
  const [batch,    setBatch]    = useState('');
  const [classId,  setClassId]  = useState('');
  const [progress, setProgress] = useState(0);
  const [stage,    setStage]    = useState<'idle' | 'uploading' | 'saving' | 'done'>('idle');
  const [error,    setError]    = useState('');

  const handleUpload = async () => {
    if (!file || !title.trim()) { setError('Title and PDF file are required'); return; }
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
          subject,
          product,
          batch: batch.trim() || null,
          classSessionId: classId ? Number(classId) : null,
        }),
      });
      if (!res.ok) throw new Error('Metadata save failed');
      const mat = await res.json() as Material;
      onUploaded(mat);
      setStage('done');
      // Reset
      setTimeout(() => {
        setFile(null); setTitle(''); setBatch(''); setClassId('');
        setProgress(0); setStage('idle');
      }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
      setStage('idle');
    }
  };

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <FieldLabel>Title *</FieldLabel>
          <FieldInput value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Class Notes – English Week 3" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <FieldLabel>Subject *</FieldLabel>
            <FieldSelect value={subject} onChange={e => setSubject(e.target.value)}>
              {SUBJECTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </FieldSelect>
          </div>
          <div>
            <FieldLabel>Product *</FieldLabel>
            <FieldSelect value={product} onChange={e => setProduct(e.target.value)}>
              <option value="iba">IBA</option>
              <option value="fbs">FBS</option>
              <option value="fbs_detailed">FBS Detailed</option>
            </FieldSelect>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <FieldLabel>Batch (blank = all)</FieldLabel>
            <FieldInput value={batch} onChange={e => setBatch(e.target.value)} placeholder="e.g. 2025" />
          </div>
          <div>
            <FieldLabel>Link to Class (optional)</FieldLabel>
            <FieldSelect value={classId} onChange={e => setClassId(e.target.value)}>
              <option value="">— none —</option>
              {sessions.map(s => (
                <option key={s.id} value={s.id}>{s.title} ({fmtDhaka(s.scheduledAt, { dateStyle: 'short' })})</option>
              ))}
            </FieldSelect>
          </div>
        </div>
        <div>
          <FieldLabel>PDF File *</FieldLabel>
          <input
            type="file" accept="application/pdf"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            style={{ fontSize: 13, color: SLATE }}
          />
          {file && <p style={{ margin: '4px 0 0', fontSize: 11, color: MUTED }}>{file.name} — {fmtSize(file.size)}</p>}
        </div>
        {stage === 'uploading' && (
          <div>
            <div style={{ background: '#F3F4F6', borderRadius: 4, height: 4 }}>
              <div style={{ height: 4, borderRadius: 4, background: RED, width: `${progress}%`, transition: 'width 0.3s' }} />
            </div>
            <p style={{ fontSize: 11, color: MUTED, margin: '4px 0 0' }}>Uploading… {progress}%</p>
          </div>
        )}
        {stage === 'done' && <p style={{ fontSize: 13, color: '#047857', fontWeight: 600 }}>Uploaded successfully!</p>}
        {error && <p style={{ fontSize: 12, color: RED, margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <PrimaryBtn
            onClick={handleUpload}
            disabled={!file || !title.trim() || stage !== 'idle'}
            loading={stage === 'uploading' || stage === 'saving'}
          >
            <Upload size={14} aria-hidden />
            Upload PDF
          </PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

// ─── Add Link flow ────────────────────────────────────────────────────────────

function AddLinkTab({
  sessions, onAdded,
}: {
  sessions: ClassSession[]; onAdded: (m: Material) => void;
}) {
  const [title,   setTitle]   = useState('');
  const [url,     setUrl]     = useState('');
  const [subject, setSubject] = useState('english');
  const [product, setProduct] = useState('iba');
  const [batch,   setBatch]   = useState('');
  const [classId, setClassId] = useState('');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const handleAdd = async () => {
    if (!title.trim() || !url.trim()) { setError('Title and URL are required'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/lms/admin/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(), type: 'link', blobUrl: url.trim(),
          subject, product, batch: batch.trim() || null,
          classSessionId: classId ? Number(classId) : null,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const mat = await res.json() as Material;
      onAdded(mat);
      setTitle(''); setUrl(''); setBatch(''); setClassId('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <FieldLabel>Title *</FieldLabel>
          <FieldInput value={title} onChange={e => setTitle(e.target.value)} placeholder="Link title" />
        </div>
        <div>
          <FieldLabel>URL *</FieldLabel>
          <FieldInput value={url} onChange={e => setUrl(e.target.value)} type="url" placeholder="https://…" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <FieldLabel>Subject *</FieldLabel>
            <FieldSelect value={subject} onChange={e => setSubject(e.target.value)}>
              {SUBJECTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </FieldSelect>
          </div>
          <div>
            <FieldLabel>Product *</FieldLabel>
            <FieldSelect value={product} onChange={e => setProduct(e.target.value)}>
              <option value="iba">IBA</option>
              <option value="fbs">FBS</option>
              <option value="fbs_detailed">FBS Detailed</option>
            </FieldSelect>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <FieldLabel>Batch (blank = all)</FieldLabel>
            <FieldInput value={batch} onChange={e => setBatch(e.target.value)} placeholder="e.g. 2025" />
          </div>
          <div>
            <FieldLabel>Link to Class (optional)</FieldLabel>
            <FieldSelect value={classId} onChange={e => setClassId(e.target.value)}>
              <option value="">— none —</option>
              {sessions.map(s => (
                <option key={s.id} value={s.id}>{s.title} ({fmtDhaka(s.scheduledAt, { dateStyle: 'short' })})</option>
              ))}
            </FieldSelect>
          </div>
        </div>
        {error && <p style={{ fontSize: 12, color: RED, margin: 0 }}>{error}</p>}
        <PrimaryBtn onClick={handleAdd} loading={saving}>
          <Plus size={14} aria-hidden />
          Add Link
        </PrimaryBtn>
      </div>
    </div>
  );
}

// ─── Materials list ───────────────────────────────────────────────────────────

function MaterialsList({
  materials, sessions, onDeleted, onUpload,
}: {
  materials: Material[]; sessions: ClassSession[]; onDeleted: (id: number) => void; onUpload: () => void;
}) {
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/lms/admin/materials/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      onDeleted(deleteId);
      showToast('Deleted');
    } catch {
      showToast('Delete failed');
    } finally {
      setDeleting(false); setDeleteId(null);
    }
  };

  const sessionMap = new Map(sessions.map(s => [s.id, s]));

  if (materials.length === 0) return (
    <EmptyState
      icon={FileText}
      message="No materials yet. Upload a PDF or add a link."
      action={
        <PrimaryBtn onClick={onUpload} small>
          <Upload size={13} aria-hidden />
          Upload PDF
        </PrimaryBtn>
      }
    />
  );

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {materials.map((m, i) => (
          <motion.div
            key={m.id}
            custom={i} variants={rowV} initial="hidden" animate="visible"
            style={{
              background: '#FFFFFF', border: `1px solid ${BORDER}`,
              borderRadius: 10, padding: '13px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 8, flexShrink: 0,
              background: m.type === 'pdf' ? 'rgba(214,43,56,0.08)' : 'rgba(59,130,246,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {m.type === 'pdf'
                ? <FileText size={16} style={{ color: RED }} aria-hidden />
                : <LinkIcon size={16} style={{ color: '#3B82F6' }} aria-hidden />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: SLATE }}>{m.title}</p>
                <SubjectBadge subject={m.subject} />
                {m.batch && <span style={{ fontSize: 11, color: MUTED }}>Batch {m.batch}</span>}
              </div>
              <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
                {fmtDhaka(m.createdAt, { dateStyle: 'medium' })}
                {m.fileSize ? ` · ${fmtSize(m.fileSize)}` : ''}
                {m.classSessionId ? ` · ${sessionMap.get(m.classSessionId)?.title ?? 'Class #' + m.classSessionId}` : ''}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <a href={m.blobUrl} target="_blank" rel="noopener noreferrer">
                <IconBtn icon={ExternalLink} label="Open" onClick={() => {}} />
              </a>
              <IconBtn icon={Trash2} label="Delete" danger onClick={() => setDeleteId(m.id)} />
            </div>
          </motion.div>
        ))}
      </div>
      <ConfirmDialog
        open={!!deleteId} title="Delete this material?"
        message="PDF files will also be removed from storage."
        confirmLabel="Delete" destructive loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
      <Toast message={toast} />
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MaterialsClient({ initialMaterials, sessions }: Props) {
  const [tab, setTab] = useState<'list' | 'upload' | 'link'>('list');
  const [materials, setMaterials] = useState(initialMaterials);

  const handleAdded = (m: Material) => {
    setMaterials(prev => [m, ...prev]);
    setTab('list');
  };

  const handleDeleted = (id: number) => {
    setMaterials(prev => prev.filter(m => m.id !== id));
  };

  return (
    <>
      <PageHeader
        title="Materials"
        subtitle={`${materials.length} material${materials.length !== 1 ? 's' : ''} — PDFs and links for students`}
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <PrimaryBtn onClick={() => setTab('upload')} disabled={tab === 'upload'}>
              <Upload size={14} aria-hidden />
              Upload PDF
            </PrimaryBtn>
            <GhostBtn onClick={() => setTab('link')} disabled={tab === 'link'}>
              <Plus size={14} aria-hidden />
              Add Link
            </GhostBtn>
          </div>
        }
      />
      <TabBar
        tabs={[
          { id: 'list',   label: `All Materials (${materials.length})` },
          { id: 'upload', label: 'Upload PDF' },
          { id: 'link',   label: 'Add Link' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as 'list' | 'upload' | 'link')}
      />
      <AnimatePresence mode="wait">
        {tab === 'list'   && <MaterialsList key="list" materials={materials} sessions={sessions} onDeleted={handleDeleted} onUpload={() => setTab('upload')} />}
        {tab === 'upload' && <UploadPdfTab key="upload" sessions={sessions} onUploaded={handleAdded} />}
        {tab === 'link'   && <AddLinkTab   key="link"   sessions={sessions} onAdded={handleAdded} />}
      </AnimatePresence>
    </>
  );
}

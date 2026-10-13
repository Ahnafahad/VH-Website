'use client';

/**
 * One-step material add for the active class: drop a file or paste a link,
 * add instructions, confirm "Added by", done. The material is attached to this
 * class by the server (classSessionId), so there is no second "link" step.
 */

import React, { useRef, useState } from 'react';
import { Upload, Link2, FileText, ExternalLink, Trash2, Unlink, Loader2, Paperclip } from 'lucide-react';
import {
  RED, MUTED, SLATE, BORDER, BORDER_FIELD, SURFACE, SURFACE_ALT, R_MD, T_XS, T_SM, T_BASE,
  FieldInput, FieldLabel, FieldTextarea, useConfirm, fmtDhaka,
} from '../lms-shared';
import { uploadToR2 } from '@/lib/lms/upload-client';
import { trackFeature } from '@/lib/analytics/tracker';
import { suggestMaterialFields } from '@/lib/naming/suggest';
import { DOC_TYPES } from '@/lib/naming/taxonomy';
import {
  classifyMaterialFile, normaliseMaterialLink, titleFromFileName,
} from '@/lib/lms/today-cockpit';
import { Btn, apiJson, mutedText } from './cockpit-ui';

export interface ClassMaterial {
  id: number;
  title: string;
  type: string; // pdf | html | link
  blobUrl: string;
  fileName: string | null;
  fileSize: number | null;
  instructions: string | null;
  addedByName: string | null;
  createdAt: number;
}

export default function MaterialsSection({
  sessionId, materials, adminName, onAdded, onRemoved, notify,
}: {
  sessionId: number;
  materials: ClassMaterial[] | null;
  adminName: string;
  onAdded: (m: ClassMaterial) => void;
  onRemoved: (materialId: number) => void;
  notify: (m: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState('');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [addedBy, setAddedBy] = useState(adminName);
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState<'idle' | 'uploading' | 'saving'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirm, confirmDialog] = useConfirm();

  const pickFile = (f: File | null) => {
    setError('');
    if (!f) { setFile(null); return; }
    const c = classifyMaterialFile(f);
    if (!c.ok) { setError(c.error); return; }
    setFile(f);
    setLink('');
    if (!title.trim()) setTitle(titleFromFileName(f.name));
  };

  const onLinkChange = (v: string) => {
    setLink(v);
    if (v.trim()) setFile(null);
  };

  const reset = () => {
    setFile(null); setLink(''); setTitle(''); setInstructions(''); setProgress(0); setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const add = async () => {
    setError('');
    const url = link.trim() ? normaliseMaterialLink(link) : null;
    if (!file && !url) { setError(link.trim() ? 'That is not a valid http(s) link.' : 'Drop a file or paste a link first.'); return; }
    const kind = file ? classifyMaterialFile(file) : null;
    if (kind && !kind.ok) { setError(kind.error); return; }
    const finalTitle = title.trim() || (file ? titleFromFileName(file.name) : new URL(url as string).host);
    try {
      let type: 'pdf' | 'html' | 'link' = 'link';
      let blobUrl = url ?? '';
      let fileName: string | null = null;
      let fileSize: number | null = null;
      if (file && kind?.ok) {
        type = kind.kind;
        setStage('uploading'); setProgress(0);
        const html = kind.kind === 'html';
        const { key } = await uploadToR2({
          // Some browsers report an empty type for .html; pin it so the presign matches.
          file: html && file.type !== 'text/html' ? new File([file], file.name, { type: 'text/html' }) : file,
          endpoint: '/api/lms/admin/materials/upload',
          onProgress: setProgress,
        });
        blobUrl = key; fileName = file.name; fileSize = file.size;
      }
      setStage('saving');
      const sug = file ? suggestMaterialFields(file.name) : null;
      const created = await apiJson<ClassMaterial>('/api/lms/admin/materials', {
        method: 'POST',
        json: {
          title: finalTitle, type, blobUrl, fileName, fileSize,
          classSessionId: sessionId,
          // Subject/product/batch are inherited from the class by the server.
          docType: sug?.docType ?? DOC_TYPES[0].key,
          number: sug?.number ?? null,
          topic: sug?.topic ?? null,
          instructions: instructions.trim() || null,
          addedByName: addedBy.trim() || null,
        },
      });
      trackFeature('material_uploaded', 'lms', { classSessionId: sessionId, source: 'today' });
      onAdded(created);
      notify('Material added to this class.');
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the material.');
    } finally {
      setStage('idle');
    }
  };

  const detach = async (m: ClassMaterial) => {
    setBusyId(m.id);
    try {
      await apiJson(`/api/lms/admin/classes/${sessionId}/materials?materialId=${m.id}`, { method: 'DELETE' });
      onRemoved(m.id);
      notify('Detached from this class. It stays in the Materials library.');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not detach.');
    } finally { setBusyId(null); }
  };

  const remove = async (m: ClassMaterial) => {
    const ok = await confirm({
      title: 'Delete this material?',
      message: `"${m.title}" will be deleted everywhere, not just from this class.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    setBusyId(m.id);
    try {
      await apiJson(`/api/lms/admin/materials/${m.id}`, { method: 'DELETE' });
      onRemoved(m.id);
      notify('Material deleted.');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not delete.');
    } finally { setBusyId(null); }
  };

  const busy = stage !== 'idle';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 8 }}>
      {/* ── One-step add ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0] ?? null); }}
          style={{
            border: `1.5px dashed ${dragging ? RED : BORDER_FIELD}`, borderRadius: R_MD, padding: 14,
            textAlign: 'center', background: dragging ? SURFACE_ALT : SURFACE,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          }}
        >
          <Upload size={18} style={{ color: MUTED }} aria-hidden />
          {file ? (
            <p style={{ margin: 0, fontSize: T_BASE, color: SLATE, fontWeight: 600 }}>
              {file.name} <span style={{ ...mutedText, display: 'inline' }}>· {(file.size / 1024 / 1024).toFixed(1)} MB</span>
            </p>
          ) : (
            <p style={mutedText}>Drop a PDF or HTML file here, or</p>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,text/html,.pdf,.html,.htm"
            onChange={e => pickFile(e.target.files?.[0] ?? null)}
            aria-label="Choose a file"
            style={{ fontSize: T_SM, maxWidth: '100%' }}
          />
        </div>

        <div>
          <FieldLabel htmlFor="tdy-mat-link">Or paste a link</FieldLabel>
          <FieldInput id="tdy-mat-link" value={link} onChange={e => onLinkChange(e.target.value)} placeholder="https://..." inputMode="url" />
        </div>

        <div className="tdy-cols" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <FieldLabel htmlFor="tdy-mat-title">Title</FieldLabel>
            <FieldInput id="tdy-mat-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Filled from the file name" />
          </div>
          <div>
            <FieldLabel htmlFor="tdy-mat-by">Added by</FieldLabel>
            <FieldInput id="tdy-mat-by" value={addedBy} onChange={e => setAddedBy(e.target.value)} maxLength={120} />
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="tdy-mat-ins">Instructions (optional)</FieldLabel>
          <FieldTextarea id="tdy-mat-ins" value={instructions} onChange={e => setInstructions(e.target.value)} maxLength={2000} placeholder="What students should do with this, e.g. read pages 3 to 7 before Thursday." style={{ minHeight: 64 }} />
        </div>

        {stage === 'uploading' && (
          <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
            <div style={{ background: SURFACE_ALT, borderRadius: 4, height: 4 }}>
              <div style={{ height: 4, borderRadius: 4, background: RED, width: '100%', transform: `scaleX(${progress / 100})`, transformOrigin: 'left', transition: 'transform 0.3s' }} />
            </div>
            <p style={{ ...mutedText, fontSize: T_XS, marginTop: 4 }}>Uploading… {progress}%</p>
          </div>
        )}
        {error && <p role="alert" style={{ margin: 0, fontSize: T_SM, color: RED }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn variant="primary" onClick={() => void add()} loading={busy} disabled={!file && !link.trim()}>
            <Paperclip size={13} aria-hidden />Add to this class
          </Btn>
          {(file || link || title || instructions) && !busy && <Btn onClick={reset}>Clear</Btn>}
          <span style={{ ...mutedText, fontSize: T_XS }}>Course, subject, batch and access come from the class.</span>
        </div>
      </div>

      {/* ── Existing materials ───────────────────────────────────────────── */}
      <div>
        <p style={{ ...mutedText, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: T_XS, marginBottom: 6 }}>
          Attached to this class{materials ? ` (${materials.length})` : ''}
        </p>
        {materials === null ? (
          <Loader2 size={16} style={{ color: MUTED, animation: 'spin 1s linear infinite' }} aria-label="Loading materials" />
        ) : materials.length === 0 ? (
          <p style={mutedText}>Nothing attached yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, border: `1px solid ${BORDER}`, borderRadius: R_MD, background: SURFACE }}>
            {materials.map((m, i) => (
              <li key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderTop: i === 0 ? 'none' : `1px solid ${BORDER}`, flexWrap: 'wrap' }}>
                <span style={{ marginTop: 2, color: MUTED, flexShrink: 0 }} aria-hidden>
                  {m.type === 'link' ? <Link2 size={15} /> : <FileText size={15} />}
                </span>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: T_BASE, fontWeight: 600, color: SLATE, overflowWrap: 'anywhere' }}>
                    {m.title} <span style={{ fontSize: T_XS, color: MUTED, fontWeight: 700, textTransform: 'uppercase' }}>{m.type}</span>
                  </p>
                  <p style={{ ...mutedText, fontSize: T_XS }}>
                    {m.addedByName ? `Added by ${m.addedByName} · ` : ''}{fmtDhaka(m.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
                    {m.fileSize ? ` · ${(m.fileSize / 1024 / 1024).toFixed(1)} MB` : ''}
                  </p>
                  {m.instructions && <p style={{ margin: '4px 0 0', fontSize: T_SM, color: SLATE, whiteSpace: 'pre-wrap' }}>{m.instructions}</p>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Btn href={m.type === 'html' ? `/dashboard/materials/${m.id}` : m.blobUrl} ariaLabel={`Open ${m.title}`}><ExternalLink size={13} aria-hidden />Open</Btn>
                  <Btn onClick={() => void detach(m)} disabled={busyId === m.id} ariaLabel={`Detach ${m.title} from this class`}><Unlink size={13} aria-hidden />Detach</Btn>
                  <Btn variant="danger" onClick={() => void remove(m)} disabled={busyId === m.id} ariaLabel={`Delete ${m.title}`}><Trash2 size={13} aria-hidden /></Btn>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {confirmDialog}
    </div>
  );
}

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Link as LinkIcon, Trash2, Upload, ExternalLink, Plus, Paperclip, Pencil } from 'lucide-react';
import { uploadToR2 } from '@/lib/lms/upload-client';
import { trackFeature } from '@/lib/analytics/tracker';
import {
  SubjectBadge, Toast, ConfirmDialog, TabBar,
  FieldLabel, FieldInput, FieldSelect, PrimaryBtn, GhostBtn,
  IconBtn, EmptyState, PageHeader,
  CourseSelect, SubjectSelect, DocTypeSelect, BatchSelect,
  getLastUsedBatch, setLastUsedBatch,
  fmtDhaka, RED, SLATE, BORDER, MUTED, rowV, backdropV, modalV,
  extractPdfHeading,
} from './lms-shared';
import {
  COURSES, SUBJECTS, DOC_TYPES, BATCHES,
  CourseKey, SubjectKey, DocTypeKey, BatchKey,
} from '@/lib/naming/taxonomy';
import { formatMaterialName } from '@/lib/naming/format-name';
import { suggestMaterialFields, type Provenance } from '@/lib/naming/suggest';
import { getLastUsed, setLastUsed, type ExistingMaterial } from '@/lib/naming/predict';
import { classUsableName, planClassRenameFromMaterial, cleanHeading } from '@/lib/naming/class-link';
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
  docType: string | null;
  number: string | null;
  topic: string | null;
  classSessionId: number | null;
  uploadedBy: number;
  createdAt: number;
}

interface Props {
  initialMaterials: Material[];
  sessions: ClassSession[];
}

// What a class becomes when it inherits a linked material's name (fed back up
// so the list re-labels it without a refetch).
interface RenamedClass {
  id: number;
  title: string;
  subject: SubjectKey;
  topic: string | null;
  classNumber: number | null;
}

// ─── Format file size ─────────────────────────────────────────────────────────

function fmtSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function docTypeLabel(key: string | null): string | null {
  if (!key) return null;
  return DOC_TYPES.find(d => d.key === key)?.label ?? key;
}

// ─── Title field with "Reset to auto" affordance ──────────────────────────────

function TitleField({
  label, title, titleManual, onChange, onReset, placeholder,
}: {
  label: string; title: string; titleManual: boolean;
  onChange: (v: string) => void; onReset: () => void; placeholder?: string;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <label style={{
          fontSize: 11, fontWeight: 700, color: '#6B7280',
          letterSpacing: '0.07em', textTransform: 'uppercase',
        }}>
          {label}
        </label>
        {titleManual && (
          <button
            type="button"
            onClick={onReset}
            style={{ background: 'none', border: 'none', color: RED, fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0 }}
          >
            Reset to auto
          </button>
        )}
      </div>
      <FieldInput value={title} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

// ─── Provenance tag — shows where an autofilled value came from ──────────────

const PROVENANCE_LABEL: Record<Exclude<Provenance, null>, string> = {
  filename: 'from file',
  'last-used': 'last used',
  sequence: 'next in sequence',
  default: 'default',
  'linked-class': 'from class',
  pdf: 'from PDF',
};

function ProvenanceTag({ provenance }: { provenance: Provenance }) {
  if (!provenance) return null;
  const lowConfidence = provenance === 'sequence' || provenance === 'default' || provenance === 'pdf';
  return (
    <p style={{
      margin: '4px 0 0', fontSize: 10, fontWeight: 600,
      color: lowConfidence ? RED : MUTED,
      letterSpacing: '0.02em',
    }}>
      {lowConfidence ? '● ' : ''}{PROVENANCE_LABEL[provenance]}
    </p>
  );
}

// ─── Upload PDF flow ──────────────────────────────────────────────────────────

type SuggestibleField = 'course' | 'subject' | 'docType' | 'number' | 'topic';

function UploadPdfTab({
  sessions, initialMaterials, onUploaded,
}: {
  sessions: ClassSession[]; initialMaterials: Material[]; onUploaded: (m: Material) => void;
}) {
  const [file,        setFile]        = useState<File | null>(null);
  const [title,       setTitle]       = useState('');
  const [titleManual, setTitleManual] = useState(false);
  const [subject,     setSubjectRaw]  = useState<SubjectKey>(SUBJECTS[0].key);
  const [course,      setCourseRaw]   = useState<CourseKey>(COURSES[0].key);
  const [batch,       setBatch]       = useState<BatchKey | null>(() => getLastUsedBatch() ?? BATCHES[0].key);
  const [docType,     setDocTypeRaw]  = useState<DocTypeKey>(DOC_TYPES[0].key);
  const [number,      setNumberRaw]   = useState('');
  const [topic,       setTopicRaw]    = useState('');
  const [classId,     setClassId]     = useState('');
  const [progress,    setProgress]    = useState(0);
  const [stage,       setStage]       = useState<'idle' | 'uploading' | 'saving' | 'done'>('idle');
  const [error,       setError]       = useState('');

  // Provenance per field, for the tags — and "touched", so a later file pick
  // (or the admin's own edit) never clobbers a value the admin already set
  // by hand. Autofill only ever writes to an untouched field.
  const [provenance, setProvenance] = useState<Partial<Record<SuggestibleField, Provenance>>>({});
  const [touched,    setTouched]    = useState<Record<SuggestibleField, boolean>>({
    course: false, subject: false, docType: false, number: false, topic: false,
  });
  // Mirrors touched.topic but readable synchronously inside async PDF-heading
  // callbacks (state would be stale there).
  const topicTouchedRef = React.useRef(false);

  const setSubject = (v: SubjectKey) => { setSubjectRaw(v); setTouched(t => ({ ...t, subject: true })); setProvenance(p => ({ ...p, subject: null })); };
  const setCourse  = (v: CourseKey)  => { setCourseRaw(v);  setTouched(t => ({ ...t, course: true }));  setProvenance(p => ({ ...p, course: null })); };
  const setDocType = (v: DocTypeKey) => { setDocTypeRaw(v); setTouched(t => ({ ...t, docType: true })); setProvenance(p => ({ ...p, docType: null })); };
  const setNumber  = (v: string)     => { setNumberRaw(v);  setTouched(t => ({ ...t, number: true }));  setProvenance(p => ({ ...p, number: null })); };
  const setTopic   = (v: string)     => { setTopicRaw(v);   setTouched(t => ({ ...t, topic: true }));   setProvenance(p => ({ ...p, topic: null })); topicTouchedRef.current = true; };

  const selectedSession = sessions.find((session) => String(session.id) === classId) ?? null;

  // Existing materials with both docType and number set, mapped to the
  // engine's ExistingMaterial shape — this is what drives sequence
  // prediction (Layer 3). Free-text values outside the taxonomy (older rows,
  // e.g. product 'tbd') fall back to null rather than being cast blind.
  const existingMaterials = useMemo<ExistingMaterial[]>(() => initialMaterials
    .filter(m => m.docType && m.number)
    .map(m => ({
      course:  COURSES.find(c => c.key === m.product)?.key  ?? null,
      subject: SUBJECTS.find(s => s.key === m.subject)?.key ?? null,
      docType: DOC_TYPES.find(d => d.key === m.docType)?.key ?? null,
      number:  m.number,
    })), [initialMaterials]);

  const handleFileChange = (f: File | null) => {
    setFile(f);
    if (!f) return;
    const suggestion = suggestMaterialFields(f.name, {
      lastUsed: {
        course:  getLastUsed('course')  as CourseKey  | null,
        subject: getLastUsed('subject') as SubjectKey | null,
        docType: getLastUsed('docType') as DocTypeKey | null,
      },
      existing: existingMaterials,
    });

    if (suggestion.course  !== null && !touched.course)  setCourseRaw(suggestion.course);
    if (suggestion.subject !== null && !touched.subject) setSubjectRaw(suggestion.subject);
    if (suggestion.docType !== null && !touched.docType) setDocTypeRaw(suggestion.docType);
    if (suggestion.number  !== null && !touched.number)  setNumberRaw(suggestion.number);

    setProvenance(p => ({
      ...p,
      course:  (suggestion.course  !== null && !touched.course)  ? suggestion.provenance.course  : p.course  ?? null,
      subject: (suggestion.subject !== null && !touched.subject) ? suggestion.provenance.subject : p.subject ?? null,
      docType: (suggestion.docType !== null && !touched.docType) ? suggestion.provenance.docType : p.docType ?? null,
      number:  (suggestion.number  !== null && !touched.number)  ? suggestion.provenance.number  : p.number  ?? null,
    }));

    // Topic — priority: linked class name > filename > PDF heading. Never
    // overrides a topic the admin typed (topicTouchedRef).
    if (!topicTouchedRef.current) {
      const className = classUsableName(selectedSession);
      if (className) {
        setTopicRaw(className);
        setProvenance(p => ({ ...p, topic: 'linked-class' }));
      } else if (suggestion.topic) {
        setTopicRaw(suggestion.topic);
        setProvenance(p => ({ ...p, topic: 'filename' }));
      } else {
        // Last resort: read the PDF's own first-page heading. Async, and may
        // fail (CSP / CDN / scanned PDF) — degrade silently to no suggestion.
        extractPdfHeading(f).then(raw => {
          const clean = cleanHeading(raw);
          if (!clean || topicTouchedRef.current) return;
          setTopicRaw(prev => (prev.trim() ? prev : clean));
          setProvenance(p => (p.topic ? p : { ...p, topic: 'pdf' }));
        }).catch(() => {});
      }
    }
  };

  // Linking a class after the file is chosen adopts the class's lesson name as
  // the topic (highest-priority source), unless the admin has typed their own.
  useEffect(() => {
    if (topicTouchedRef.current) return;
    const className = classUsableName(selectedSession);
    if (className) {
      setTopicRaw(className);
      setProvenance(p => ({ ...p, topic: 'linked-class' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  // A linked session's subject/product are free-text columns and may hold values
  // outside the taxonomy (recurring sessions are generated with subject 'tbd').
  // Only inherit them when they're real taxonomy keys, else fall back to the
  // form's own selects — otherwise the title reads "IBA tbd Lecture 1.3".
  const inheritedCourse  = COURSES.find(c => c.key === selectedSession?.product)?.key;
  const inheritedSubject = SUBJECTS.find(s => s.key === selectedSession?.subject)?.key;

  const autoTitle = formatMaterialName({
    course:  inheritedCourse  ?? course,
    subject: inheritedSubject ?? subject,
    docType,
    number: number.trim() || null,
    topic:  topic.trim() || null,
  });

  useEffect(() => {
    if (!titleManual) setTitle(autoTitle);
  }, [autoTitle, titleManual]);

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
          title: title.trim() || autoTitle,
          type: 'pdf',
          blobUrl: key,
          fileName: file.name,
          fileSize: file.size,
          subject,
          product: course,
          batch,
          docType,
          number: number.trim() || null,
          topic: topic.trim() || null,
          classSessionId: classId ? Number(classId) : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? 'The material details could not be saved');
      }
      const mat = await res.json() as Material;
      onUploaded(mat);
      if (batch) setLastUsedBatch(batch);
      setLastUsed('course', course);
      setLastUsed('subject', subject);
      setLastUsed('docType', docType);
      trackFeature('material_uploaded', 'lms', {
        classSessionId: selectedSession?.id ?? null,
        source: 'materials',
      });

      // If the linked class has no real lesson name ("Thursday Class",
      // "English Class 3"), it inherits this material's identity — subject,
      // name, number, canonical title. planClassRenameFromMaterial returns null
      // (and we skip) for a class that already has a real name.
      if (selectedSession) {
        const plan = planClassRenameFromMaterial(
          {
            title: selectedSession.title, subject: selectedSession.subject,
            topic: selectedSession.topic, product: selectedSession.product,
            classNumber: selectedSession.classNumber,
          },
          { course, subject, docType, number, topic },
        );
        if (plan) {
          try {
            await fetch(`/api/lms/admin/classes/${selectedSession.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                subject: plan.subject, topic: plan.topic,
                classNumber: plan.classNumber, title: plan.title,
              }),
            });
          } catch {
            // Non-fatal — the material already saved.
          }
        }
      }

      setStage('done');
      // Reset
      setTimeout(() => {
        setFile(null); setTitle(''); setTitleManual(false);
        setNumberRaw(''); setTopicRaw(''); setClassId('');
        setProgress(0); setStage('idle');
        setTouched({ course: false, subject: false, docType: false, number: false, topic: false });
        topicTouchedRef.current = false;
        setProvenance({});
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
          <FieldLabel>Class to share with</FieldLabel>
          <FieldSelect value={classId} onChange={e => setClassId(e.target.value)}>
            <option value="">Standalone material</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>{s.title} ({fmtDhaka(s.scheduledAt, { dateStyle: 'short' })})</option>
            ))}
          </FieldSelect>
          <p style={{ margin: '5px 0 0', fontSize: 11, lineHeight: 1.5, color: MUTED }}>
            {selectedSession
              ? `Course, batch, and student access will match ${selectedSession.title}.`
              : 'Choose a class to fill course access automatically.'}
          </p>
        </div>
        <div>
          <FieldLabel>PDF File *</FieldLabel>
          <input
            type="file"
            accept="application/pdf"
            onChange={e => handleFileChange(e.target.files?.[0] ?? null)}
            style={{ width: '100%', minHeight: 44, padding: '10px 12px', fontSize: 13, color: SLATE, border: `1px solid ${BORDER}`, borderRadius: 10, background: '#FFFFFF' }}
          />
          {file && <p style={{ margin: '4px 0 0', fontSize: 11, color: MUTED }}>{file.name} — {fmtSize(file.size)}</p>}
        </div>
        {!selectedSession && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <SubjectSelect value={subject} onChange={setSubject} />
            <ProvenanceTag provenance={provenance.subject ?? null} />
          </div>
          <div>
            <CourseSelect value={course} onChange={setCourse} />
            <ProvenanceTag provenance={provenance.course ?? null} />
          </div>
        </div>}
        {!selectedSession && (
          <BatchSelect value={batch} onChange={setBatch} />
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <div>
            <DocTypeSelect value={docType} onChange={setDocType} />
            <ProvenanceTag provenance={provenance.docType ?? null} />
          </div>
          <div>
            <FieldLabel>Number</FieldLabel>
            <FieldInput value={number} onChange={e => setNumber(e.target.value)} placeholder="e.g. 1.3 or 4" />
            <ProvenanceTag provenance={provenance.number ?? null} />
          </div>
        </div>
        <div>
          <FieldLabel>Topic (optional)</FieldLabel>
          <FieldInput value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Advanced Sentence Structures" />
          <ProvenanceTag provenance={provenance.topic ?? null} />
        </div>
        <TitleField
          label="Lecture title"
          title={title}
          titleManual={titleManual}
          onChange={v => { setTitle(v); setTitleManual(true); }}
          onReset={() => { setTitleManual(false); setTitle(autoTitle); }}
          placeholder="Auto-generated from the fields above"
        />
        {stage === 'uploading' && (
          <div>
            <div style={{ background: '#F3F4F6', borderRadius: 4, height: 4 }}>
              <div style={{ height: 4, borderRadius: 4, background: RED, width: '100%', transform: `scaleX(${progress / 100})`, transformOrigin: 'left', transition: 'transform 0.3s' }} />
            </div>
            <p style={{ fontSize: 11, color: MUTED, margin: '4px 0 0' }}>Uploading… {progress}%</p>
          </div>
        )}
        {stage === 'done' && <p style={{ fontSize: 13, color: '#047857', fontWeight: 600 }}>Uploaded successfully!</p>}
        {error && <p style={{ fontSize: 12, color: RED, margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <PrimaryBtn
            onClick={handleUpload}
            disabled={!file || stage !== 'idle'}
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
  const [title,       setTitle]       = useState('');
  const [titleManual, setTitleManual] = useState(false);
  const [url,         setUrl]         = useState('');
  const [subject,     setSubjectRaw]  = useState<SubjectKey>(() => (getLastUsed('subject') as SubjectKey | null) ?? SUBJECTS[0].key);
  const [course,      setCourseRaw]   = useState<CourseKey>(()  => (getLastUsed('course')  as CourseKey  | null) ?? COURSES[0].key);
  const [batch,       setBatch]       = useState<BatchKey | null>(() => getLastUsedBatch() ?? BATCHES[0].key);
  const [docType,     setDocTypeRaw]  = useState<DocTypeKey>(() => (getLastUsed('docType') as DocTypeKey | null) ?? DOC_TYPES[0].key);
  const [number,      setNumber]      = useState('');
  const [topic,       setTopic]       = useState('');
  const [classId,     setClassId]     = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  // "last used" tags for the three sticky fields, consistent with Upload PDF.
  // Add Link has no file, so no filename layer — this is the only provenance
  // that can apply here.
  const [tags, setTags] = useState<{ subject: Provenance; course: Provenance; docType: Provenance }>(() => ({
    subject: getLastUsed('subject') ? 'last-used' : null,
    course:  getLastUsed('course')  ? 'last-used' : null,
    docType: getLastUsed('docType') ? 'last-used' : null,
  }));

  const setSubject = (v: SubjectKey) => { setSubjectRaw(v); setTags(t => ({ ...t, subject: null })); };
  const setCourse  = (v: CourseKey)  => { setCourseRaw(v);  setTags(t => ({ ...t, course: null })); };
  const setDocType = (v: DocTypeKey) => { setDocTypeRaw(v); setTags(t => ({ ...t, docType: null })); };

  const autoTitle = formatMaterialName({
    course, subject, docType,
    number: number.trim() || null,
    topic:  topic.trim() || null,
  });

  useEffect(() => {
    if (!titleManual) setTitle(autoTitle);
  }, [autoTitle, titleManual]);

  const handleAdd = async () => {
    if (!title.trim() || !url.trim()) { setError('Title and URL are required'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/lms/admin/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(), type: 'link', blobUrl: url.trim(),
          subject, product: course, batch,
          docType, number: number.trim() || null, topic: topic.trim() || null,
          classSessionId: classId ? Number(classId) : null,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const mat = await res.json() as Material;
      onAdded(mat);
      if (batch) setLastUsedBatch(batch);
      setTitle(''); setTitleManual(false); setUrl(''); setNumber(''); setTopic(''); setClassId('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <TitleField
          label="Title *"
          title={title}
          titleManual={titleManual}
          onChange={v => { setTitle(v); setTitleManual(true); }}
          onReset={() => { setTitleManual(false); setTitle(autoTitle); }}
          placeholder="Link title"
        />
        <div>
          <FieldLabel>URL *</FieldLabel>
          <FieldInput value={url} onChange={e => setUrl(e.target.value)} type="url" placeholder="https://…" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <SubjectSelect value={subject} onChange={setSubject} />
            <ProvenanceTag provenance={tags.subject} />
          </div>
          <div>
            <CourseSelect value={course} onChange={setCourse} />
            <ProvenanceTag provenance={tags.course} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <BatchSelect value={batch} onChange={setBatch} />
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <DocTypeSelect value={docType} onChange={setDocType} />
            <ProvenanceTag provenance={tags.docType} />
          </div>
          <div>
            <FieldLabel>Number</FieldLabel>
            <FieldInput value={number} onChange={e => setNumber(e.target.value)} placeholder="e.g. 1.3 or 4" />
          </div>
        </div>
        <div>
          <FieldLabel>Topic (optional)</FieldLabel>
          <FieldInput value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Advanced Sentence Structures" />
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

// ─── Link-to-class dialog ─────────────────────────────────────────────────────
// Attach an existing material to a class after the fact. Reuses the same
// fill-blank-never-clobber sync as upload: a class with no lesson name inherits
// this material's identity; a named class is left untouched.

function LinkClassDialog({
  material, sessions, onClose, onLinked,
}: {
  material: Material; sessions: ClassSession[];
  onClose: () => void;
  onLinked: (materialId: number, classSessionId: number | null, renamed?: RenamedClass) => void;
}) {
  const [classId, setClassId] = useState(material.classSessionId ? String(material.classSessionId) : '');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const newClassId = classId ? Number(classId) : null;
      const res = await fetch(`/api/lms/admin/materials/${material.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classSessionId: newClassId }),
      });
      if (!res.ok) throw new Error('Could not link this material');

      // If the newly-linked class has no lesson name, it inherits this
      // material's identity — same rule as upload.
      let renamed: RenamedClass | undefined;
      const target = newClassId ? sessions.find(s => s.id === newClassId) : null;
      if (target) {
        const plan = planClassRenameFromMaterial(
          { title: target.title, subject: target.subject, topic: target.topic, product: target.product, classNumber: target.classNumber },
          { course: material.product as CourseKey, subject: material.subject as SubjectKey,
            docType: material.docType as DocTypeKey | null, number: material.number ?? '', topic: material.topic ?? '' },
        );
        if (plan) {
          try {
            await fetch(`/api/lms/admin/classes/${target.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ subject: plan.subject, topic: plan.topic, classNumber: plan.classNumber, title: plan.title }),
            });
            renamed = { id: target.id, title: plan.title, subject: plan.subject, topic: plan.topic, classNumber: plan.classNumber };
          } catch {
            // Non-fatal — the material link already saved.
          }
        }
      }
      onLinked(material.id, newClassId, renamed);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        variants={backdropV} initial="hidden" animate="visible" exit="exit"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      >
        <motion.div
          variants={modalV} initial="hidden" animate="visible" exit="exit"
          onClick={e => e.stopPropagation()}
          style={{ background: '#FFFFFF', borderRadius: 12, padding: 20, width: '100%', maxWidth: 420,
            display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: SLATE }}>Link to class</p>
          <p style={{ margin: 0, fontSize: 12, color: MUTED }}>
            An unnamed class (&ldquo;Thursday Class&rdquo;) will take this material&rsquo;s name; a class that already has a name is left as-is.
          </p>
          <div>
            <FieldLabel>Class</FieldLabel>
            <FieldSelect value={classId} onChange={e => setClassId(e.target.value)}>
              <option value="">— No class (standalone) —</option>
              {sessions.map(s => (
                <option key={s.id} value={s.id}>{s.title} ({fmtDhaka(s.scheduledAt, { dateStyle: 'short' })})</option>
              ))}
            </FieldSelect>
          </div>
          {error && <p style={{ fontSize: 12, color: RED, margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <GhostBtn onClick={onClose}>Cancel</GhostBtn>
            <PrimaryBtn onClick={handleSave} loading={saving}>Save</PrimaryBtn>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Edit material dialog ─────────────────────────────────────────────────────
// Wires up the fields the PATCH endpoint already accepts (title, subject,
// product, batch, docType, number, topic) but that the list UI never exposed.

function EditMaterialDialog({
  material, onClose, onSaved,
}: {
  material: Material;
  onClose: () => void;
  onSaved: (updated: Material) => void;
}) {
  const [title,   setTitle]   = useState(material.title);
  const [subject, setSubject] = useState<SubjectKey>(material.subject as SubjectKey);
  const [course,  setCourse]  = useState<CourseKey>(material.product as CourseKey);
  const [batch,   setBatch]   = useState<BatchKey | null>(material.batch as BatchKey | null);
  const [docType, setDocType] = useState<DocTypeKey>((material.docType as DocTypeKey | null) ?? DOC_TYPES[0].key);
  const [number,  setNumber]  = useState(material.number ?? '');
  const [topic,   setTopic]   = useState(material.topic ?? '');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch(`/api/lms/admin/materials/${material.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(), subject, product: course, batch,
          docType, number: number.trim() || null, topic: topic.trim() || null,
        }),
      });
      if (!res.ok) throw new Error('Could not save these changes');
      const updated = await res.json() as Material;
      onSaved(updated);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        variants={backdropV} initial="hidden" animate="visible" exit="exit"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      >
        <motion.div
          variants={modalV} initial="hidden" animate="visible" exit="exit"
          onClick={e => e.stopPropagation()}
          style={{ background: '#FFFFFF', borderRadius: 12, padding: 20, width: '100%', maxWidth: 460,
            maxHeight: '90vh', overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: SLATE }}>Edit material</p>
          <div>
            <FieldLabel>Title</FieldLabel>
            <FieldInput value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <SubjectSelect value={subject} onChange={setSubject} />
            <CourseSelect value={course} onChange={setCourse} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <BatchSelect value={batch} onChange={setBatch} />
            <DocTypeSelect value={docType} onChange={setDocType} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <FieldLabel>Number</FieldLabel>
              <FieldInput value={number} onChange={e => setNumber(e.target.value)} placeholder="e.g. 1.3 or 4" />
            </div>
            <div>
              <FieldLabel>Topic</FieldLabel>
              <FieldInput value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Advanced Sentence Structures" />
            </div>
          </div>
          {error && <p style={{ fontSize: 12, color: RED, margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <GhostBtn onClick={onClose}>Cancel</GhostBtn>
            <PrimaryBtn onClick={handleSave} loading={saving}>Save</PrimaryBtn>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Materials list ───────────────────────────────────────────────────────────

function MaterialsList({
  materials, sessions, onDeleted, onLinked, onEdited, onUpload,
}: {
  materials: Material[]; sessions: ClassSession[];
  onDeleted: (id: number) => void;
  onLinked: (materialId: number, classSessionId: number | null, renamed?: RenamedClass) => void;
  onEdited: (updated: Material) => void;
  onUpload: () => void;
}) {
  const [linkMaterial, setLinkMaterial] = useState<Material | null>(null);
  const [editMaterial, setEditMaterial] = useState<Material | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [filterCourse,  setFilterCourse]  = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterDocType, setFilterDocType] = useState('all');
  const [filterBatch,   setFilterBatch]   = useState('all');

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

  // Batch is free text on older rows, so filter options come from the data
  // itself rather than the (currently single-entry) taxonomy list.
  const batchOptions = Array.from(new Set(materials.map(m => m.batch).filter((b): b is string => !!b))).sort();

  const sorted = [...materials].sort((a, b) => b.createdAt - a.createdAt);
  const filtered = sorted.filter(m =>
    (filterCourse  === 'all' || m.product === filterCourse) &&
    (filterSubject === 'all' || m.subject === filterSubject) &&
    (filterDocType === 'all' || m.docType === filterDocType) &&
    (filterBatch   === 'all' || m.batch === filterBatch)
  );

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
        <div>
          <FieldLabel>Course</FieldLabel>
          <FieldSelect value={filterCourse} onChange={e => setFilterCourse(e.target.value)}>
            <option value="all">All</option>
            {COURSES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </FieldSelect>
        </div>
        <div>
          <FieldLabel>Subject</FieldLabel>
          <FieldSelect value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
            <option value="all">All</option>
            {SUBJECTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </FieldSelect>
        </div>
        <div>
          <FieldLabel>Doc Type</FieldLabel>
          <FieldSelect value={filterDocType} onChange={e => setFilterDocType(e.target.value)}>
            <option value="all">All</option>
            {DOC_TYPES.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
          </FieldSelect>
        </div>
        <div>
          <FieldLabel>Batch</FieldLabel>
          <FieldSelect value={filterBatch} onChange={e => setFilterBatch(e.target.value)}>
            <option value="all">All</option>
            {batchOptions.map(b => <option key={b} value={b}>{b}</option>)}
          </FieldSelect>
        </div>
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon={FileText} message="No materials match these filters." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((m, i) => (
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
                  {docTypeLabel(m.docType) && (
                    <span style={{ fontSize: 11, color: MUTED }}>
                      {docTypeLabel(m.docType)}{m.number ? ` ${m.number}` : ''}
                    </span>
                  )}
                  {m.batch && <span style={{ fontSize: 11, color: MUTED }}>Batch {m.batch}</span>}
                </div>
                <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
                  {m.topic ? `${m.topic} · ` : ''}
                  {fmtDhaka(m.createdAt, { dateStyle: 'medium' })}
                  {m.fileSize ? ` · ${fmtSize(m.fileSize)}` : ''}
                  {m.classSessionId ? ` · ${sessionMap.get(m.classSessionId)?.title ?? 'Class #' + m.classSessionId}` : ''}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <a href={m.blobUrl} target="_blank" rel="noopener noreferrer">
                  <IconBtn icon={ExternalLink} label="Open" onClick={() => {}} />
                </a>
                <IconBtn icon={Pencil} label="Edit details" onClick={() => setEditMaterial(m)} />
                <IconBtn icon={Paperclip} label="Link to class" onClick={() => setLinkMaterial(m)} />
                <IconBtn icon={Trash2} label="Delete" danger onClick={() => setDeleteId(m.id)} />
              </div>
            </motion.div>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={!!deleteId} title="Delete this material?"
        message="PDF files will also be removed from storage."
        confirmLabel="Delete" destructive loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
      {linkMaterial && (
        <LinkClassDialog
          material={linkMaterial}
          sessions={sessions}
          onClose={() => setLinkMaterial(null)}
          onLinked={onLinked}
        />
      )}
      {editMaterial && (
        <EditMaterialDialog
          material={editMaterial}
          onClose={() => setEditMaterial(null)}
          onSaved={onEdited}
        />
      )}
      <Toast message={toast} />
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MaterialsClient({ initialMaterials, sessions: initialSessions }: Props) {
  const [tab, setTab] = useState<'list' | 'upload' | 'link'>('list');
  const [materials, setMaterials] = useState(initialMaterials);
  // Sessions are state (not just a prop) so a class renamed via the "Link to
  // class" flow updates its label in the list immediately.
  const [sessions, setSessions] = useState(initialSessions);

  const handleAdded = (m: Material) => {
    setMaterials(prev => [m, ...prev]);
    setTab('list');
  };

  const handleDeleted = (id: number) => {
    setMaterials(prev => prev.filter(m => m.id !== id));
  };

  const handleEdited = (updated: Material) => {
    setMaterials(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
  };

  const handleLinked = (materialId: number, classSessionId: number | null, renamed?: RenamedClass) => {
    setMaterials(prev => prev.map(m => m.id === materialId ? { ...m, classSessionId } : m));
    if (renamed) {
      setSessions(prev => prev.map(s => s.id === renamed.id
        ? { ...s, title: renamed.title, subject: renamed.subject, topic: renamed.topic, classNumber: renamed.classNumber }
        : s));
    }
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
        {tab === 'list'   && <MaterialsList key="list" materials={materials} sessions={sessions} onDeleted={handleDeleted} onLinked={handleLinked} onEdited={handleEdited} onUpload={() => setTab('upload')} />}
        {tab === 'upload' && <UploadPdfTab key="upload" sessions={sessions} initialMaterials={initialMaterials} onUploaded={handleAdded} />}
        {tab === 'link'   && <AddLinkTab   key="link"   sessions={sessions} onAdded={handleAdded} />}
      </AnimatePresence>
    </>
  );
}

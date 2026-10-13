'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Link as LinkIcon, Trash2, Upload, ExternalLink, Plus, Paperclip, Pencil } from 'lucide-react';
import { uploadToR2 } from '@/lib/lms/upload-client';
import { HTML_FILE_NAME_RE, HTML_MATERIAL_MAX_BYTES } from '@/lib/lms/html-material';
import { trackFeature } from '@/lib/analytics/tracker';
import {
  Toast, ConfirmDialog,
  FieldLabel, FieldInput, FieldSelect, PrimaryBtn, GhostBtn,
  IconBtn, EmptyState, PageHeader, FormActions,
  CourseSelect, SubjectSelect, DocTypeSelect, BatchSelect,
  getLastUsedBatch, setLastUsedBatch,
  fmtDhaka, RED, SLATE, BORDER, MUTED, backdropV, modalV, titleCase,
  extractPdfHeading,
  SURFACE, SURFACE_ALT, OK, INFO, INFO_BG,
  R_SM, R_MD, R_LG, SHADOW_LG, FONT_HEADING, RED_HOVER, BEIGE,
  SPIN_CSS, T_XS, T_SM, T_BASE,
} from './lms-shared';
import {
  COURSES, SUBJECTS, DOC_TYPES, BATCHES,
  CourseKey, SubjectKey, DocTypeKey, BatchKey,
} from '@/lib/naming/taxonomy';
import { formatMaterialName } from '@/lib/naming/format-name';
import { suggestMaterialFields, type Provenance } from '@/lib/naming/suggest';
import { getLastUsed, setLastUsed, type ExistingMaterial } from '@/lib/naming/predict';
import { classUsableName, cleanHeading } from '@/lib/naming/class-link';
import type { ClassSession } from './ClassesClient';
import { useAdminProduct } from '@/components/admin/AdminProductContext';
import {
  Drawer, MonthGroup, Toolbar, ToolbarSpacer, SearchBox, SortMenu, CountTabs, KIT_CSS,
  MATERIAL_SORTS, MATERIAL_GROUPS, MATERIAL_SORT_LABELS, MATERIAL_GROUP_LABELS,
  sortMaterials, groupByMonth, groupInOrder, initialOpenMonths, currentMonthKey, readPref, writePref,
  suggestClassForFile,
  type MaterialSort, type MaterialGroup,
} from './kit';

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
      <style>{`
        .lms-materials-reset:hover { color: ${RED_HOVER}; }
        .lms-materials-reset:focus-visible { outline: 2px solid ${RED}; outline-offset: 2px; border-radius: ${R_SM}px; }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <label style={{
          fontSize: T_XS, fontWeight: 700, color: MUTED,
          letterSpacing: '0.07em', textTransform: 'uppercase',
        }}>
          {label}
        </label>
        {titleManual && (
          <button
            type="button"
            className="lms-materials-reset"
            onClick={onReset}
            style={{ background: 'none', border: 'none', color: RED, fontSize: T_XS, fontWeight: 600, cursor: 'pointer', padding: 0 }}
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

// ─── Upload file flow (PDF or HTML) ───────────────────────────────────────────

const isHtmlFile = (f: File) => f.type === 'text/html' || HTML_FILE_NAME_RE.test(f.name);

type SuggestibleField = 'course' | 'subject' | 'docType' | 'number' | 'topic';

function UploadPdfTab({
  sessions, initialMaterials, onUploaded,
}: {
  sessions: ClassSession[]; initialMaterials: Material[]; onUploaded: (m: Material) => void;
}) {
  const { product: adminProduct } = useAdminProduct();
  const [file,        setFile]        = useState<File | null>(null);
  const [title,       setTitle]       = useState('');
  const [titleManual, setTitleManual] = useState(false);
  const [subject,     setSubjectRaw]  = useState<SubjectKey>(SUBJECTS[0].key);
  const [course,      setCourseRaw]   = useState<CourseKey>(adminProduct);
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

  // Keep the course selector aligned with the admin panel's active FBS/IBA
  // mode if the admin hasn't picked one by hand — otherwise a standalone
  // upload silently saves under whichever course this form happened to
  // mount with, regardless of which panel the admin is looking at.
  useEffect(() => {
    if (!touched.course) setCourseRaw(adminProduct);
  }, [adminProduct, touched.course]);

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
        // HTML files have no PDF heading to read.
        if (!isHtmlFile(f)) extractPdfHeading(f).then(raw => {
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
    if (!file) { setError('Choose a PDF or HTML file to upload'); return; }
    const html = isHtmlFile(file);
    if (!html && file.type !== 'application/pdf') { setError('Only PDF or HTML files can be uploaded'); return; }
    if (html && file.size > HTML_MATERIAL_MAX_BYTES) { setError('HTML files must be under 10 MB'); return; }
    setError('');
    try {
      setStage('uploading');
      const { key } = await uploadToR2({
        // Some browsers/OSes report an empty type for .html — pin it so the presign matches.
        file: html && file.type !== 'text/html' ? new File([file], file.name, { type: 'text/html' }) : file,
        endpoint: '/api/lms/admin/materials/upload',
        onProgress: pct => setProgress(pct),
      });
      setStage('saving');
      const res = await fetch('/api/lms/admin/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || autoTitle,
          type: html ? 'html' : 'pdf',
          blobUrl: key,
          fileName: file.name,
          fileSize: file.size,
          subject: inheritedSubject ?? subject,
          product: inheritedCourse ?? course,
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
      // "English Class 3"), the server renames it to inherit this material's
      // identity (POST /api/lms/admin/materials propagates server-side).

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
          <p style={{ margin: '4px 0 0', fontSize: T_XS, lineHeight: 1.5, color: MUTED }}>
            {selectedSession
              ? `Course, batch, and student access will match ${selectedSession.title}.`
              : 'Choose a class to fill course access automatically.'}
          </p>
        </div>
        <div>
          <FieldLabel>PDF or HTML File *</FieldLabel>
          <style>{`
            .lms-materials-file-input:hover { border-color: ${BEIGE}; }
            .lms-materials-file-input:focus-visible { outline: 2px solid ${RED}; outline-offset: 2px; }
          `}</style>
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFileChange(e.dataTransfer.files?.[0] ?? null); }}
          >
            <input
              type="file"
              accept="application/pdf,text/html,.html,.htm"
              className="lms-materials-file-input"
              onChange={e => handleFileChange(e.target.files?.[0] ?? null)}
              style={{ width: '100%', minHeight: 44, padding: '10px 12px', fontSize: T_BASE, color: SLATE, border: `1px dashed ${BORDER}`, borderRadius: R_MD, background: SURFACE, transition: 'border-color 0.14s' }}
            />
            <p style={{ margin: '4px 0 0', fontSize: T_XS, color: MUTED }}>Choose a file, or drop one here.</p>
          </div>
          {file && <p style={{ margin: '4px 0 0', fontSize: T_XS, color: MUTED }}>{file.name} — {fmtSize(file.size)}</p>}
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
            <div style={{ background: SURFACE_ALT, borderRadius: 4, height: 4 }}>
              <div style={{ height: 4, borderRadius: 4, background: RED, width: '100%', transform: `scaleX(${progress / 100})`, transformOrigin: 'left', transition: 'transform 0.3s' }} />
            </div>
            <p style={{ fontSize: T_XS, color: MUTED, margin: '4px 0 0' }}>Uploading… {progress}%</p>
          </div>
        )}
        {stage === 'done' && <p style={{ fontSize: T_BASE, color: OK, fontWeight: 600 }}>Uploaded successfully!</p>}
        {error && <p style={{ fontSize: T_SM, color: RED, margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <PrimaryBtn
            onClick={handleUpload}
            disabled={!file || stage !== 'idle'}
            loading={stage === 'uploading' || stage === 'saving'}
          >
            <Upload size={14} aria-hidden />
            Upload file
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
        {error && <p style={{ fontSize: T_SM, color: RED, margin: 0 }}>{error}</p>}
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

      // Server propagates the material's identity to the newly-linked class
      // when it has no lesson name yet; it reports back what it renamed so
      // the list can reflect it without a refetch.
      const body = await res.json() as { renamedClasses?: RenamedClass[] };
      const renamed = body.renamedClasses?.find(r => r.id === newClassId);
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
        style={{ position: 'fixed', inset: 0, background: `${SLATE}73`, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      >
        <motion.div
          variants={modalV} initial="hidden" animate="visible" exit="exit"
          onClick={e => e.stopPropagation()}
          style={{ background: SURFACE, borderRadius: R_LG, padding: 20, width: '100%', maxWidth: 420,
            boxShadow: SHADOW_LG, display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: SLATE, fontFamily: FONT_HEADING }}>Link to class</p>
          <p style={{ margin: 0, fontSize: T_SM, color: MUTED }}>
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
          {error && <p style={{ fontSize: T_SM, color: RED, margin: 0 }}>{error}</p>}
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
        style={{ position: 'fixed', inset: 0, background: `${SLATE}73`, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      >
        <motion.div
          variants={modalV} initial="hidden" animate="visible" exit="exit"
          onClick={e => e.stopPropagation()}
          style={{ background: SURFACE, borderRadius: R_LG, padding: 20, width: '100%', maxWidth: 460,
            maxHeight: '90vh', overflowY: 'auto', boxShadow: SHADOW_LG,
            display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: SLATE, fontFamily: FONT_HEADING }}>Edit material</p>
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
          {error && <p style={{ fontSize: T_SM, color: RED, margin: 0 }}>{error}</p>}
          <FormActions>
            <GhostBtn onClick={onClose}>Cancel</GhostBtn>
            <PrimaryBtn onClick={handleSave} loading={saving}>Save</PrimaryBtn>
          </FormActions>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Materials list ───────────────────────────────────────────────────────────

const SORT_PREF_KEY = 'lms.materials.sort';
const GROUP_PREF_KEY = 'lms.materials.group';

type MaterialsTab = 'all' | 'unattached';

function MaterialsList({
  materials, sessions, onDeleted, onLinked, onEdited, onAdd, onToast,
}: {
  materials: Material[]; sessions: ClassSession[];
  onDeleted: (id: number) => void;
  onLinked: (materialId: number, classSessionId: number | null, renamed?: RenamedClass) => void;
  onEdited: (updated: Material) => void;
  onAdd: () => void;
  onToast: (m: string) => void;
}) {
  const { product: adminProduct } = useAdminProduct();
  const [linkMaterial, setLinkMaterial] = useState<Material | null>(null);
  const [editMaterial, setEditMaterial] = useState<Material | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState<MaterialsTab>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<MaterialSort>('newest');
  const [group, setGroup] = useState<MaterialGroup>('month');
  const [openOverride, setOpenOverride] = useState<Record<string, boolean>>({});
  const [attaching, setAttaching] = useState<number | null>(null);

  // Remembered choices are read after mount so server and first client render
  // agree; storage can be blocked, which readPref tolerates.
  useEffect(() => {
    setSort(readPref(SORT_PREF_KEY, MATERIAL_SORTS, 'newest'));
    setGroup(readPref(GROUP_PREF_KEY, MATERIAL_GROUPS, 'month'));
  }, []);
  const changeSort = (v: MaterialSort) => { setSort(v); writePref(SORT_PREF_KEY, v); };
  const changeGroup = (v: MaterialGroup) => { setGroup(v); writePref(GROUP_PREF_KEY, v); };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/lms/admin/materials/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      onDeleted(deleteId);
      onToast('Deleted');
    } catch {
      onToast('Delete failed');
    } finally {
      setDeleting(false); setDeleteId(null);
    }
  };

  const sessionMap = useMemo(() => new Map(sessions.map(s => [s.id, s])), [sessions]);
  const mine = useMemo(() => materials.filter(m => m.product === adminProduct), [materials, adminProduct]);
  const unattached = useMemo(() => mine.filter(m => m.classSessionId == null), [mine]);

  // One suggestion per unattached file, from its file name (falling back to
  // its title). Computed once per change, not per render of each row.
  const suggestions = useMemo(() => {
    const out = new Map<number, ClassSession>();
    const pool = sessions.filter(s => s.status !== 'cancelled');
    for (const m of unattached) {
      const hit = (m.fileName && suggestClassForFile(m.fileName, adminProduct, pool))
        || suggestClassForFile(m.title, adminProduct, pool);
      if (hit) out.set(m.id, sessions.find(s => s.id === hit.id) as ClassSession);
    }
    return out;
  }, [unattached, sessions, adminProduct]);

  // One-tap attach: update the row immediately, roll back if the server says no.
  const attach = async (m: Material, cls: ClassSession) => {
    setAttaching(m.id);
    onLinked(m.id, cls.id);
    try {
      const res = await fetch(`/api/lms/admin/materials/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classSessionId: cls.id }),
      });
      if (!res.ok) throw new Error('Failed');
      const body = await res.json() as { renamedClasses?: RenamedClass[] };
      const renamed = body.renamedClasses?.find(r => r.id === cls.id);
      if (renamed) onLinked(m.id, cls.id, renamed);
      onToast(`Attached to ${renamed?.title ?? cls.title}`);
    } catch {
      onLinked(m.id, m.classSessionId);
      onToast('Could not attach. Try again.');
    } finally {
      setAttaching(null);
    }
  };

  if (materials.length === 0) return (
    <EmptyState
      icon={FileText}
      message="No materials yet. Upload a PDF or HTML file, or add a link."
      action={
        <PrimaryBtn onClick={onAdd} small>
          <Plus size={13} aria-hidden />
          Add material
        </PrimaryBtn>
      }
    />
  );

  const q = query.trim().toLowerCase();
  const pool = tab === 'unattached' ? unattached : mine;
  const visible = pool.filter(m =>
    !q || `${m.title} ${m.fileName ?? ''} ${m.topic ?? ''}`.toLowerCase().includes(q));

  // Groups: months keep a fixed calendar order (items inside follow the sort);
  // class and subject order the groups themselves.
  type Bucket = { key: string; label: string; items: Material[]; thisMonth?: boolean };
  let buckets: Bucket[];
  if (group === 'none') {
    buckets = [{ key: 'all', label: 'All files', items: sortMaterials(visible, sort) }];
  } else if (group === 'month') {
    const current = currentMonthKey();
    buckets = groupByMonth(visible, m => m.createdAt, sort !== 'oldest')
      .map(b => ({ ...b, items: sortMaterials(b.items, sort), thisMonth: b.key === current }));
  } else if (group === 'subject') {
    buckets = groupInOrder(sortMaterials(visible, sort), m => ({
      key: m.subject, label: titleCase(m.subject.replace(/_/g, ' ')),
    })).sort((a, b) => a.label.localeCompare(b.label));
  } else {
    buckets = groupInOrder(sortMaterials(visible, sort), m => {
      const s = m.classSessionId != null ? sessionMap.get(m.classSessionId) : undefined;
      return m.classSessionId == null
        ? { key: 'none', label: 'Not attached' }
        : { key: String(m.classSessionId), label: s?.title ?? `Class #${m.classSessionId}` };
    }).sort((a, b) => {
      if (a.key === 'none') return -1;
      if (b.key === 'none') return 1;
      return (sessionMap.get(Number(b.key))?.scheduledAt ?? 0) - (sessionMap.get(Number(a.key))?.scheduledAt ?? 0);
    });
  }
  const defaultOpen = group === 'month' ? initialOpenMonths(buckets.map(b => b.key)) : null;
  const isOpen = (b: Bucket) => openOverride[`${group}:${b.key}`] ?? (q ? true : defaultOpen ? defaultOpen.has(b.key) : true);

  const renderRow = (m: Material, i: number) => {
    const cls = m.classSessionId != null ? sessionMap.get(m.classSessionId) : undefined;
    const suggestion = m.classSessionId == null ? suggestions.get(m.id) : undefined;
    return (
      <div
        key={m.id}
        className="kit-row"
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', minHeight: 52, flexWrap: 'wrap',
          borderTop: i === 0 ? 0 : `1px solid ${BORDER}`,
        }}
      >
        <span style={{ width: 40, flexShrink: 0, fontSize: T_XS, color: MUTED, fontFamily: 'var(--font-mono), ui-monospace, monospace', textTransform: 'uppercase' }}>
          {m.type === 'link' ? <LinkIcon size={14} aria-label="Link" style={{ color: INFO }} /> : m.type}
        </span>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div style={{ fontSize: T_BASE, fontWeight: 600, color: SLATE, overflowWrap: 'anywhere' }}>{m.title}</div>
          <div style={{ fontSize: T_XS, color: MUTED, marginTop: 2 }}>
            {[
              fmtSize(m.fileSize) || null,
              fmtDhaka(m.createdAt, { day: '2-digit', month: 'short' }),
              docTypeLabel(m.docType) ? `${docTypeLabel(m.docType)}${m.number ? ` ${m.number}` : ''}` : null,
              m.batch ? `Batch ${m.batch}` : null,
              cls ? cls.title : (m.classSessionId ? `Class #${m.classSessionId}` : null),
            ].filter(Boolean).join(' · ')}
          </div>
        </div>
        {m.classSessionId == null && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {suggestion ? (
              <>
                <span className="kit-hide-sm" style={{
                  fontSize: T_SM, color: INFO, background: INFO_BG, borderRadius: R_SM, padding: '3px 8px',
                }}>
                  Looks like <b>{suggestion.title}</b>
                </span>
                <GhostBtn small onClick={() => void attach(m, suggestion)} disabled={attaching === m.id}>
                  Attach
                </GhostBtn>
              </>
            ) : (
              <GhostBtn small onClick={() => setLinkMaterial(m)}>Attach to class</GhostBtn>
            )}
          </span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, justifyContent: 'flex-end' }}>
          <IconBtn icon={ExternalLink} label={`Open ${m.title}`} href={m.type === 'html' ? `/dashboard/materials/${m.id}` : m.blobUrl} />
          <IconBtn icon={Pencil} label={`Edit details of ${m.title}`} onClick={() => setEditMaterial(m)} />
          <IconBtn icon={Paperclip} label={`Link ${m.title} to class`} onClick={() => setLinkMaterial(m)} />
          {/* Wider gap + divider before Delete so it isn't a mis-tap target
              next to the other (non-destructive) actions on a phone. */}
          <div aria-hidden style={{ width: 1, height: 24, background: BORDER, margin: '0 4px' }} />
          <IconBtn icon={Trash2} label={`Delete ${m.title}`} danger onClick={() => setDeleteId(m.id)} />
        </div>
      </div>
    );
  };

  return (
    <>
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_LG, overflow: 'hidden' }}>
        <Toolbar>
          <CountTabs
            label="Materials view"
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'all', label: 'All', count: mine.length },
              { id: 'unattached', label: 'Not attached', count: unattached.length, alert: true },
            ]}
          />
          <ToolbarSpacer />
          <SearchBox value={query} onChange={setQuery} placeholder="Search files" label="Search files" />
          <SortMenu
            label="Sort"
            value={sort}
            onChange={changeSort}
            options={MATERIAL_SORTS.map(v => ({ value: v, label: MATERIAL_SORT_LABELS[v] }))}
          />
          <SortMenu
            label="Group"
            value={group}
            onChange={changeGroup}
            options={MATERIAL_GROUPS.map(v => ({ value: v, label: MATERIAL_GROUP_LABELS[v] }))}
          />
          <PrimaryBtn onClick={onAdd} small>
            <Plus size={13} aria-hidden />
            Add material
          </PrimaryBtn>
        </Toolbar>

        {visible.length === 0 ? (
          <div style={{ padding: 16 }}>
            <EmptyState
              icon={FileText}
              message={tab === 'unattached' && !q ? 'Every file is attached to a class.' : 'No materials match.'}
            />
          </div>
        ) : group === 'none' ? (
          buckets[0].items.map(renderRow)
        ) : buckets.map(b => (
          <MonthGroup
            key={b.key}
            label={b.label}
            open={isOpen(b)}
            onToggle={() => setOpenOverride(o => ({ ...o, [`${group}:${b.key}`]: !isOpen(b) }))}
            thisMonth={b.thisMonth}
            summary={`${b.items.length} ${b.items.length === 1 ? 'file' : 'files'}`}
          >
            {b.items.map(renderRow)}
          </MonthGroup>
        ))}
      </div>
      <ConfirmDialog
        open={!!deleteId} title="Delete this material?"
        message="Uploaded files will also be removed from storage."
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
    </>
  );
}

// ─── Add-material drawer (replaces the List / Upload / Add link tabs) ─────────

type AddMode = 'file' | 'link';

function AddMaterialDrawer({
  open, onClose, sessions, materials, onAdded,
}: {
  open: boolean; onClose: () => void;
  sessions: ClassSession[]; materials: Material[];
  onAdded: (m: Material) => void;
}) {
  const [mode, setMode] = useState<AddMode>('file');
  return (
    <Drawer open={open} onClose={onClose} title="Add material">
      <div style={{ marginBottom: 14, borderBottom: `1px solid ${BORDER}` }}>
        <CountTabs
          label="Material source"
          value={mode}
          onChange={setMode}
          tabs={[{ id: 'file', label: 'Upload file' }, { id: 'link', label: 'Paste link' }]}
        />
      </div>
      {mode === 'file'
        ? <UploadPdfTab sessions={sessions} initialMaterials={materials} onUploaded={onAdded} />
        : <AddLinkTab sessions={sessions} onAdded={onAdded} />}
    </Drawer>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MaterialsClient({ initialMaterials, sessions: initialSessions }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [materials, setMaterials] = useState(initialMaterials);
  const [toast, setToast] = useState<string | null>(null);
  // Sessions are state (not just a prop) so a class renamed via the "Link to
  // class" flow updates its label in the list immediately.
  const [sessions, setSessions] = useState(initialSessions);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  const handleAdded = (m: Material) => {
    setMaterials(prev => [m, ...prev]);
    setDrawerOpen(false);
    showToast('Material added');
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
      <style>{SPIN_CSS + KIT_CSS}</style>
      <PageHeader
        title="Materials"
        subtitle={`${materials.length} material${materials.length !== 1 ? 's' : ''}: PDFs, HTML files and links for students`}
      />
      <MaterialsList
        materials={materials}
        sessions={sessions}
        onDeleted={handleDeleted}
        onLinked={handleLinked}
        onEdited={handleEdited}
        onAdd={() => setDrawerOpen(true)}
        onToast={showToast}
      />
      <AddMaterialDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sessions={sessions}
        materials={materials}
        onAdded={handleAdded}
      />
      <Toast message={toast} />
    </>
  );
}

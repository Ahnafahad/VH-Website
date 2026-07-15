'use client';

import { useReducedMotion, motion, Variants } from 'motion/react';
import Link from 'next/link';
import {
  ArrowLeft, FileText, Link2, AlertCircle,
  BookOpen, Calculator, Waypoints, FlaskConical,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import type { SubjectData, SubjectAssignment, SubjectTestSection } from '@/lib/lms/subject-data';
import { SUBJECT_LABELS } from '@/lib/lms/subject-data';
import { formatDhaka } from '@/lib/lms/time';

interface Props {
  data: SubjectData;
}

// ─── Per-subject accent (small identity shift; base system unchanged) ────────

const SUBJECT_ACCENT: Record<SubjectData['subject'], { color: string; icon: React.ComponentType<LucideProps> }> = {
  english:    { color: '#8FAED1', icon: BookOpen },
  math:       { color: '#8FCBB0', icon: Calculator },
  analytical: { color: '#D4956E', icon: Waypoints },
};

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 28 } },
};

const itemVariantsReduced: Variants = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0 },
};

function formatDate(epochMs: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Dhaka',
  }).format(new Date(epochMs));
}

function SectionMarker({ label, accent }: { label: string; accent: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="font-heading italic text-sm flex-shrink-0" style={{ color: accent }}>
        {label}
      </span>
      <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(212,176,148,0.16)' }} />
    </div>
  );
}

function EmptyRow({ icon: Icon, message }: { icon: React.ComponentType<LucideProps>; message: string }) {
  return (
    <div className="flex flex-col items-start gap-2 py-4">
      <Icon className="w-6 h-6" style={{ color: 'rgba(250,245,239,0.40)' }} strokeWidth={1.25} />
      <p className="text-base" style={{ color: 'rgba(250,245,239,0.64)' }}>{message}</p>
    </div>
  );
}

function getDueUrgency(dueAt: number): 'overdue' | 'urgent' | 'normal' {
  const msLeft = dueAt - Date.now();
  if (msLeft < 0) return 'overdue';
  if (msLeft < 48 * 3600_000) return 'urgent';
  return 'normal';
}

function UrgencyLabel({ dueAt }: { dueAt: number }) {
  const urgency = getDueUrgency(dueAt);
  if (urgency === 'overdue') {
    return (
      <span className="flex items-center gap-1 text-xs" style={{ color: '#FF8A8F' }}>
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
        overdue
      </span>
    );
  }
  return (
    <span
      className="text-xs"
      style={{
        color: urgency === 'urgent' ? '#D4B094' : 'rgba(250,245,239,0.64)',
        fontFamily: 'var(--font-math-mono)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      due {formatDhaka(new Date(dueAt), 'datetime')}{urgency === 'urgent' ? ' · due soon' : ''}
    </span>
  );
}

function StatusLabel({ status }: { status: string }) {
  if (status === 'submitted') return <span className="text-xs lowercase" style={{ color: '#D4B094' }}>submitted</span>;
  if (status === 'reviewed') return <span className="text-xs lowercase" style={{ color: '#7DDFA3' }}>reviewed</span>;
  return <span className="text-xs lowercase" style={{ color: 'rgba(250,245,239,0.40)' }}>pending</span>;
}

function HomeworkRow({ a }: { a: SubjectAssignment }) {
  const subStatus = a.mySubmission === 'pending' ? 'pending' : a.mySubmission.status;
  return (
    <Link
      href={`/dashboard/assignments/${a.id}`}
      className="flex items-center gap-3 py-3 min-h-[44px] transition-opacity hover:opacity-80"
      style={{ borderBottom: '1px solid rgba(212,176,148,0.16)' }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate mb-1" style={{ color: '#FAF5EF' }}>{a.title}</p>
        <UrgencyLabel dueAt={a.dueAt} />
      </div>
      <StatusLabel status={subStatus} />
    </Link>
  );
}

function MaterialRow({ id, title, type, blobUrl, fileSize }: { id: number; title: string; type: string; blobUrl: string; fileSize: number | null }) {
  const isPdf = type === 'pdf';
  const content = (
    <>
      {isPdf ? (
        <FileText className="w-4 h-4 flex-shrink-0" style={{ color: 'rgba(250,245,239,0.40)' }} strokeWidth={1.5} />
      ) : (
        <Link2 className="w-4 h-4 flex-shrink-0" style={{ color: 'rgba(250,245,239,0.40)' }} strokeWidth={1.5} />
      )}
      <span className="text-sm flex-1 min-w-0 truncate" style={{ color: '#FAF5EF' }}>{title}</span>
      {fileSize != null && (
        <span
          className="text-xs flex-shrink-0"
          style={{ fontFamily: 'var(--font-math-mono)', fontVariantNumeric: 'tabular-nums', color: 'rgba(250,245,239,0.40)' }}
        >
          {(fileSize / 1024 / 1024).toFixed(1)} MB
        </span>
      )}
    </>
  );

  const className = 'flex items-center gap-3 py-3 min-h-[44px] transition-opacity hover:opacity-80';
  const style = { borderBottom: '1px solid rgba(212,176,148,0.16)' };

  return isPdf ? (
    <Link href={`/dashboard/materials/${id}`} className={className} style={style}>{content}</Link>
  ) : (
    <a href={blobUrl} target="_blank" rel="noopener noreferrer" className={className} style={style}>{content}</a>
  );
}

function TestSectionRow({ s }: { s: SubjectTestSection }) {
  return (
    <Link
      href={`/tests/${s.bucket}/${s.testSlug}/results`}
      className="flex items-center gap-3 py-3 min-h-[44px] transition-opacity hover:opacity-80"
      style={{ borderBottom: '1px solid rgba(212,176,148,0.16)' }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate mb-1" style={{ color: '#FAF5EF' }}>{s.testTitle}</p>
        <p className="text-xs" style={{ color: 'rgba(250,245,239,0.64)' }}>
          {s.sectionTitle} · {formatDate(s.submittedAt)}
        </p>
      </div>
      <span
        className="text-sm flex-shrink-0"
        style={{ fontFamily: 'var(--font-math-mono)', fontVariantNumeric: 'tabular-nums', color: '#FAF5EF' }}
      >
        {s.score}/{s.maxScore}
      </span>
    </Link>
  );
}

export default function SubjectDashboardScreen({ data }: Props) {
  const { subject, lectureSheets, otherMaterials, currentHomework, previousHomework, testSections } = data;
  const prefersReduced = useReducedMotion();
  const iv = prefersReduced ? itemVariantsReduced : itemVariants;

  const label = SUBJECT_LABELS[subject];
  const { color: accent, icon: SubjectIcon } = SUBJECT_ACCENT[subject];

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#1A0507' }}>
      <div
        className="max-w-3xl mx-auto px-4 sm:px-6 pb-24"
        style={{ paddingTop: 'max(6rem, calc(6rem + env(safe-area-inset-top)))' }}
      >
        <div className="pt-0 sm:pt-4" />

        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          {/* ── Header ── */}
          <motion.div variants={iv} className="mb-10">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-xs mb-6 min-h-11 w-fit transition-opacity hover:opacity-80"
              style={{ color: 'rgba(250,245,239,0.64)' }}
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
              Dashboard
            </Link>
            <div className="flex items-center gap-3">
              <SubjectIcon className="w-7 h-7 flex-shrink-0" style={{ color: accent }} strokeWidth={1.5} />
              <h1
                className="font-heading font-medium text-3xl sm:text-4xl"
                style={{ color: '#FAF5EF', letterSpacing: '-0.01em' }}
              >
                {label}
              </h1>
            </div>
          </motion.div>

          {/* ── Lecture sheets ── */}
          <motion.div variants={iv} className="mb-10">
            <SectionMarker label="lecture sheets" accent={accent} />
            {lectureSheets.length === 0 ? (
              <EmptyRow icon={FileText} message="No lecture sheets yet." />
            ) : (
              <div className="flex flex-col">
                {lectureSheets.map((m) => (
                  <MaterialRow key={m.id} id={m.id} title={m.title} type={m.type} blobUrl={m.blobUrl} fileSize={m.fileSize} />
                ))}
              </div>
            )}
          </motion.div>

          {/* ── Current homework — hidden entirely when empty ── */}
          {currentHomework.length > 0 && (
            <motion.div variants={iv} className="mb-10">
              <SectionMarker label="current homework" accent={accent} />
              <div className="flex flex-col">
                {currentHomework.map((a) => <HomeworkRow key={a.id} a={a} />)}
              </div>
            </motion.div>
          )}

          {/* ── Previous homework — hidden entirely when empty ── */}
          {previousHomework.length > 0 && (
            <motion.div variants={iv} className="mb-10">
              <SectionMarker label="previous homework" accent={accent} />
              <div className="flex flex-col">
                {previousHomework.map((a) => <HomeworkRow key={a.id} a={a} />)}
              </div>
            </motion.div>
          )}

          {/* ── Other materials — hidden entirely when empty ── */}
          {otherMaterials.length > 0 && (
            <motion.div variants={iv} className="mb-10">
              <SectionMarker label="other materials" accent={accent} />
              <div className="flex flex-col">
                {otherMaterials.map((m) => (
                  <MaterialRow key={m.id} id={m.id} title={m.title} type={m.type} blobUrl={m.blobUrl} fileSize={m.fileSize} />
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Test performance — hidden entirely when empty ── */}
          {testSections.length > 0 && (
            <motion.div variants={iv} className="mb-10">
              <SectionMarker label="test performance" accent={accent} />
              <div className="flex flex-col">
                {testSections.map((s, i) => <TestSectionRow key={`${s.testId}-${i}`} s={s} />)}
              </div>
            </motion.div>
          )}

          {/* ── Fully empty state ── */}
          {lectureSheets.length === 0 &&
            otherMaterials.length === 0 &&
            currentHomework.length === 0 &&
            previousHomework.length === 0 &&
            testSections.length === 0 && (
              <motion.div variants={iv}>
                <EmptyRow icon={FlaskConical} message={`Nothing here yet for ${label.toLowerCase()} — check back once your instructor adds materials.`} />
              </motion.div>
            )}
        </motion.div>
      </div>
    </main>
  );
}

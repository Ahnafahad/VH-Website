'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, Variants } from 'framer-motion';
import { ChevronDown, Loader2, Users } from 'lucide-react';
import type { BatchOption, StudentSummary } from '@/lib/students/progress-types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface StudentsProgressClientProps {
  initialBatches: BatchOption[];
  initialBatch:   string | null;
  initialStudents: StudentSummary[];
}

// ─── Motion variants ─────────────────────────────────────────────────────────

const rowVariants: Variants = {
  hidden:  { opacity: 0, y: 6 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 380, damping: 32, delay: i * 0.028 },
  }),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(p => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function attendanceColor(pct: number | null): string {
  if (pct == null) return '#9CA3AF';
  if (pct >= 80) return '#10B981';
  if (pct >= 50) return '#F59E0B';
  return '#EF4444';
}

// ─── Attendance pill ──────────────────────────────────────────────────────────

function AttendancePill({ pct }: { pct: number | null }) {
  const color = attendanceColor(pct);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: pct == null ? '#9CA3AF' : '#374151' }}>
        {pct == null ? '—' : `${Math.round(pct)}%`}
      </span>
    </div>
  );
}

// ─── Batch pill ───────────────────────────────────────────────────────────────

function BatchPill({
  label,
  count,
  active,
  onClick,
}: {
  label:   string;
  count:   number;
  active:  boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      style={{
        display:       'inline-flex',
        alignItems:    'center',
        gap:           6,
        padding:       '6px 14px',
        borderRadius:  100,
        fontSize:      13,
        fontWeight:    active ? 600 : 400,
        letterSpacing: '-0.01em',
        cursor:        'pointer',
        border:        active ? '1.5px solid #D62B38' : '1.5px solid #E5E7EB',
        background:    active ? 'rgba(214,43,56,0.05)' : '#FFFFFF',
        color:         active ? '#D62B38' : '#374151',
        transition:    'all 0.14s ease',
        whiteSpace:    'nowrap',
      }}
    >
      {label}
      <span style={{
        fontSize:   11,
        fontWeight: 700,
        padding:    '1px 6px',
        borderRadius: 100,
        background: active ? '#D62B38' : '#F3F4F6',
        color:      active ? '#FFFFFF' : '#9CA3AF',
      }}>
        {count}
      </span>
    </motion.button>
  );
}

// ─── Student row (desktop table) ──────────────────────────────────────────────

function StudentRow({ student, index, onClick }: { student: StudentSummary; index: number; onClick: () => void }) {
  return (
    <motion.div
      custom={index}
      variants={rowVariants}
      initial="hidden"
      animate="visible"
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`View progress for ${student.name}`}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      whileHover={{ backgroundColor: 'rgba(0,0,0,0.015)' }}
      style={{
        display:      'grid',
        gridTemplateColumns: '2fr 110px 1.4fr 100px',
        padding:      '12px 16px',
        cursor:       'pointer',
        alignItems:   'center',
        gap:          8,
      }}
    >
      {/* Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: '#F3F4F6', color: '#374151',
          fontSize: 10, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, letterSpacing: '0.03em',
        }}>
          {getInitials(student.name || 'S')}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {student.name}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {student.studentId ?? student.email}
          </p>
        </div>
      </div>

      {/* Attendance */}
      <AttendancePill pct={student.attendancePercent} />

      {/* Last test */}
      <div style={{ minWidth: 0 }}>
        {student.lastTest ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
              {student.lastTest.title}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', flexShrink: 0 }}>
              {Math.round(student.lastTest.percentage)}%
            </span>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>—</span>
        )}
      </div>

      {/* LexiCore */}
      <div style={{ fontSize: 13, fontWeight: 600, color: '#D62B38', textAlign: 'right' }}>
        {student.lexicorePoints.toLocaleString()}
      </div>
    </motion.div>
  );
}

// ─── Student card (mobile) ─────────────────────────────────────────────────────

function StudentCard({ student, index, onClick }: { student: StudentSummary; index: number; onClick: () => void }) {
  return (
    <motion.div
      custom={index}
      variants={rowVariants}
      initial="hidden"
      animate="visible"
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`View progress for ${student.name}`}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      style={{
        background:   '#FFFFFF',
        border:       '1px solid #E5E7EB',
        borderRadius: 10,
        padding:      '14px 16px',
        cursor:       'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: '#F3F4F6', color: '#374151',
          fontSize: 11, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, letterSpacing: '0.03em',
        }}>
          {getInitials(student.name || 'S')}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {student.name}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {student.studentId ?? student.email}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid #F3F4F6' }}>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Attendance</p>
          <AttendancePill pct={student.attendancePercent} />
        </div>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last Test</p>
          <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>
            {student.lastTest ? `${Math.round(student.lastTest.percentage)}%` : '—'}
          </span>
        </div>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>LexiCore</p>
          <span style={{ fontSize: 12, color: '#D62B38', fontWeight: 700 }}>
            {student.lexicorePoints.toLocaleString()}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function StudentsProgressClient({
  initialBatches,
  initialBatch,
  initialStudents,
}: StudentsProgressClientProps) {
  const router = useRouter();
  const [batches]  = useState<BatchOption[]>(initialBatches);
  const [batch, setBatch]       = useState<string>(initialBatch ?? '');
  const [students, setStudents] = useState<StudentSummary[]>(initialStudents);
  const [loading, setLoading]   = useState(false);

  const fetchBatch = async (b: string) => {
    if (!b || b === batch) { setBatch(b); return; }
    setBatch(b);
    setLoading(true);
    try {
      const res  = await fetch(`/api/admin/students?batch=${encodeURIComponent(b)}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { students: StudentSummary[] };
      setStudents(data.students);
    } catch {
      // keep current data on error
    } finally {
      setLoading(false);
    }
  };

  const goToStudent = (id: number) => router.push(`/admin/students/${id}`);

  return (
    <>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <div style={{ maxWidth: 1040, margin: '0 auto' }}>

        {/* Page title */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.04em', lineHeight: 1.2 }}>
            Students Progress
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9CA3AF' }}>
            Attendance, test performance, and LexiCore at a glance
          </p>
        </div>

        {/* Batch selector — pills (desktop/tablet) */}
        {batches.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div id="batch-pills" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {batches.map(b => (
                <BatchPill
                  key={b.batch}
                  label={b.batch}
                  count={b.studentCount}
                  active={b.batch === batch}
                  onClick={() => void fetchBatch(b.batch)}
                />
              ))}
            </div>

            {/* Batch selector — native select (mobile) */}
            <div id="batch-select" style={{ position: 'relative' }}>
              <select
                value={batch}
                onChange={e => void fetchBatch(e.target.value)}
                aria-label="Select batch"
                style={{
                  width:        '100%',
                  appearance:   'none',
                  padding:      '9px 36px 9px 12px',
                  borderRadius: 8,
                  border:       '1.5px solid #E5E7EB',
                  background:   '#FAFAFA',
                  fontSize:     13,
                  fontWeight:   600,
                  color:        '#0F172A',
                  outline:      'none',
                }}
              >
                {batches.map(b => (
                  <option key={b.batch} value={b.batch}>{b.batch} ({b.studentCount})</option>
                ))}
              </select>
              <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} aria-hidden />
            </div>

            <style>{`
              #batch-select { display: none; margin-top: 4px; }
              @media (max-width: 640px) {
                #batch-pills  { display: none !important; }
                #batch-select { display: block !important; }
              }
            `}</style>
          </div>
        )}

        {/* No batches at all */}
        {batches.length === 0 && (
          <div style={{ background: '#FAFAFA', border: '1px dashed #E5E7EB', borderRadius: 10, padding: '40px 24px', textAlign: 'center' }}>
            <Users size={22} style={{ color: '#D1D5DB', margin: '0 auto 8px' }} aria-hidden />
            <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF' }}>No batches found.</p>
          </div>
        )}

        {/* Table (desktop) / Cards (mobile) */}
        {batches.length > 0 && (
          <>
            <style>{`
              #students-table { display: block; }
              #students-cards { display: none; }
              @media (max-width: 640px) {
                #students-table { display: none !important; }
                #students-cards { display: flex !important; }
              }
            `}</style>

            {/* Desktop table */}
            <div id="students-table" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 110px 1.4fr 100px', padding: '10px 16px', background: '#FAFAFA', borderBottom: '1px solid #F3F4F6' }}>
                {['Student', 'Attendance', 'Last Test', 'LexiCore'].map((h, i) => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: i === 3 ? 'right' : 'left' }}>
                    {h}
                  </span>
                ))}
              </div>

              {loading && (
                <div style={{ padding: '32px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#9CA3AF', fontSize: 13 }}>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} aria-hidden />
                  Loading…
                </div>
              )}

              {!loading && students.length === 0 && (
                <div style={{ padding: '40px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                  No students in this batch.
                </div>
              )}

              {!loading && students.map((s, i) => (
                <div key={s.id} style={{ borderBottom: i < students.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
                  <StudentRow student={s} index={i} onClick={() => goToStudent(s.id)} />
                </div>
              ))}
            </div>

            {/* Mobile cards */}
            <div id="students-cards" style={{ flexDirection: 'column', gap: 10 }}>
              {loading && (
                <div style={{ padding: '32px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#9CA3AF', fontSize: 13 }}>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} aria-hidden />
                  Loading…
                </div>
              )}
              {!loading && students.length === 0 && (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 13, background: '#FAFAFA', border: '1px dashed #E5E7EB', borderRadius: 10 }}>
                  No students in this batch.
                </div>
              )}
              {!loading && students.map((s, i) => (
                <StudentCard key={s.id} student={s} index={i} onClick={() => goToStudent(s.id)} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

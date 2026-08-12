'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, Variants } from 'framer-motion';
import { ChevronDown, Loader2, Users } from 'lucide-react';
import type { BatchOption, StudentSummary } from '@/lib/students/progress-types';
import { AtRiskBadge, AtRiskPopover, useAtRiskPopover, type AtRiskBadgeReason } from '@/components/admin/lms/lms-shared';
import {
  RED, RED_DARK, SLATE, BORDER, BORDER_FIELD, MUTED, BG, SURFACE, SURFACE_ALT,
  INK_SOFT, OK, WARN, T_XS, T_SM, T_BASE, T_XL, R_MD, R_LG, R_PILL,
  FONT_HEADING,
} from '../lms/lms-shared';

// ─── Props ────────────────────────────────────────────────────────────────────

interface AtRiskStudentProp {
  id:      number;
  reasons: AtRiskBadgeReason[];
}

interface StudentsProgressClientProps {
  initialBatches: BatchOption[];
  initialBatch:   string | null;
  initialStudents: StudentSummary[];
  atRiskStudents?: AtRiskStudentProp[];
}

type AtRiskPopoverApi = ReturnType<typeof useAtRiskPopover>;

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
  if (pct == null) return MUTED;
  if (pct >= 80) return OK;
  if (pct >= 50) return WARN;
  return RED;
}

// ─── Attendance pill ──────────────────────────────────────────────────────────

function AttendancePill({ pct }: { pct: number | null }) {
  const color = attendanceColor(pct);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: T_BASE, fontWeight: 600, color: pct == null ? MUTED : INK_SOFT }}>
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
        borderRadius:  R_PILL,
        fontSize:      T_BASE,
        fontWeight:    active ? 600 : 400,
        letterSpacing: '-0.01em',
        cursor:        'pointer',
        border:        `1px solid ${active ? RED : BORDER_FIELD}`,
        background:    active ? `${RED}0D` : SURFACE,
        color:         active ? RED : INK_SOFT,
        transition:    'all 0.14s ease',
        whiteSpace:    'nowrap',
      }}
    >
      {label}
      <span style={{
        fontSize:   T_XS,
        fontWeight: 700,
        padding:    '1px 6px',
        borderRadius: R_PILL,
        background: active ? RED : SURFACE_ALT,
        color:      active ? SURFACE : MUTED,
      }}>
        {count}
      </span>
    </motion.button>
  );
}

// ─── Student row (desktop table) ──────────────────────────────────────────────

function StudentRow({ student, index, onClick, atRiskReasons, popover }: {
  student: StudentSummary; index: number; onClick: () => void;
  atRiskReasons?: AtRiskBadgeReason[]; popover: AtRiskPopoverApi;
}) {
  return (
    <motion.div
      custom={index}
      variants={rowVariants}
      initial="hidden"
      animate="visible"
      onClick={onClick}
      onContextMenu={(e) => { if (atRiskReasons) popover.openFromContextMenu(e, student.name, atRiskReasons); }}
      role="button"
      tabIndex={0}
      aria-label={`View progress for ${student.name}`}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      whileHover={{ backgroundColor: SURFACE_ALT }}
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
          background: SURFACE_ALT, color: INK_SOFT,
          fontSize: 10, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, letterSpacing: '0.03em',
        }}>
          {getInitials(student.name || 'S')}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: T_BASE, fontWeight: 600, color: INK_SOFT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{student.name}</span>
            {atRiskReasons && (
              <AtRiskBadge onOpen={(e) => popover.openFromBadge(e, student.name, atRiskReasons)} />
            )}
          </p>
          <p style={{ margin: 0, fontSize: T_XS, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
            <span style={{ fontSize: T_SM, color: INK_SOFT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
              {student.lastTest.title}
            </span>
            <span style={{ fontSize: T_SM, fontWeight: 700, color: SLATE, flexShrink: 0 }}>
              {Math.round(student.lastTest.percentage)}%
            </span>
          </div>
        ) : (
          <span style={{ fontSize: T_SM, color: MUTED }}>—</span>
        )}
      </div>

      {/* LexiCore */}
      <div style={{ fontSize: T_BASE, fontWeight: 600, color: RED, textAlign: 'right' }}>
        {student.lexicorePoints.toLocaleString()}
      </div>
    </motion.div>
  );
}

// ─── Student card (mobile) ─────────────────────────────────────────────────────

function StudentCard({ student, index, onClick, atRiskReasons, popover }: {
  student: StudentSummary; index: number; onClick: () => void;
  atRiskReasons?: AtRiskBadgeReason[]; popover: AtRiskPopoverApi;
}) {
  return (
    <motion.div
      custom={index}
      variants={rowVariants}
      initial="hidden"
      animate="visible"
      onClick={onClick}
      onContextMenu={(e) => { if (atRiskReasons) popover.openFromContextMenu(e, student.name, atRiskReasons); }}
      role="button"
      tabIndex={0}
      aria-label={`View progress for ${student.name}`}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      style={{
        background:   SURFACE,
        border:       `1px solid ${BORDER}`,
        borderRadius: R_LG,
        padding:      '14px 16px',
        cursor:       'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: SURFACE_ALT, color: INK_SOFT,
          fontSize: T_XS, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, letterSpacing: '0.03em',
        }}>
          {getInitials(student.name || 'S')}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: T_BASE, fontWeight: 600, color: INK_SOFT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{student.name}</span>
            {atRiskReasons && (
              <AtRiskBadge onOpen={(e) => popover.openFromBadge(e, student.name, atRiskReasons)} />
            )}
          </p>
          <p style={{ margin: 0, fontSize: T_XS, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {student.studentId ?? student.email}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Attendance</p>
          <AttendancePill pct={student.attendancePercent} />
        </div>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last Test</p>
          <span style={{ fontSize: T_SM, color: INK_SOFT, fontWeight: 600 }}>
            {student.lastTest ? `${Math.round(student.lastTest.percentage)}%` : '—'}
          </span>
        </div>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>LexiCore</p>
          <span style={{ fontSize: T_SM, color: RED, fontWeight: 700 }}>
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
  atRiskStudents = [],
}: StudentsProgressClientProps) {
  const router = useRouter();
  const [batches]  = useState<BatchOption[]>(initialBatches);
  const [batch, setBatch]       = useState<string>(initialBatch ?? '');
  const [students, setStudents] = useState<StudentSummary[]>(initialStudents);
  const [loading, setLoading]   = useState(false);
  const [loadError, setLoadError] = useState(false);
  const atRiskMap = React.useMemo(() => {
    const m = new Map<number, AtRiskBadgeReason[]>();
    for (const s of atRiskStudents) m.set(s.id, s.reasons);
    return m;
  }, [atRiskStudents]);
  const atRiskPopover = useAtRiskPopover();

  const fetchBatch = async (b: string) => {
    if (!b || b === batch) { setBatch(b); return; }
    setBatch(b);
    setLoading(true);
    setLoadError(false);
    try {
      const res  = await fetch(`/api/admin/students?batch=${encodeURIComponent(b)}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { students: StudentSummary[] };
      setStudents(data.students);
    } catch {
      // keep current data on screen, but tell the admin the switch failed
      setLoadError(true);
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
          <h1 style={{ margin: 0, fontFamily: FONT_HEADING, fontSize: T_XL, fontWeight: 700, color: SLATE, letterSpacing: '-0.04em', lineHeight: 1.2 }}>
            Students Progress
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: T_BASE, color: MUTED }}>
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
                  borderRadius: R_MD,
                  border:       `1px solid ${BORDER_FIELD}`,
                  background:   SURFACE,
                  fontSize:     T_BASE,
                  fontWeight:   600,
                  color:        SLATE,
                  outline:      'none',
                }}
              >
                {batches.map(b => (
                  <option key={b.batch} value={b.batch}>{b.batch} ({b.studentCount})</option>
                ))}
              </select>
              <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: MUTED, pointerEvents: 'none' }} aria-hidden />
            </div>

            <style>{`
              #batch-select { display: none; margin-top: 4px; }
              @media (max-width: 640px) {
                #batch-pills  { display: none !important; }
                #batch-select { display: block !important; }
              }
            `}</style>

            {loadError && (
              <p style={{ margin: '8px 0 0', fontSize: T_SM, color: RED_DARK }}>
                Couldn&apos;t load that batch. Showing previous results — try again.
              </p>
            )}
          </div>
        )}

        {/* No batches at all */}
        {batches.length === 0 && (
          <div style={{ background: BG, border: `1px dashed ${BORDER}`, borderRadius: R_LG, padding: '40px 24px', textAlign: 'center' }}>
            <Users size={22} style={{ color: MUTED, margin: '0 auto 8px' }} aria-hidden />
            <p style={{ margin: 0, fontSize: T_BASE, color: MUTED }}>No batches found.</p>
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
            <div id="students-table" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_LG, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 110px 1.4fr 100px', padding: '10px 16px', background: SURFACE_ALT, borderBottom: `1px solid ${BORDER}` }}>
                {['Student', 'Attendance', 'Last Test', 'LexiCore'].map((h, i) => (
                  <span key={h} style={{ fontSize: T_XS, fontWeight: 600, color: MUTED, letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: i === 3 ? 'right' : 'left' }}>
                    {h}
                  </span>
                ))}
              </div>

              {loading && (
                <div style={{ padding: '32px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: MUTED, fontSize: T_BASE }}>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} aria-hidden />
                  Loading…
                </div>
              )}

              {!loading && students.length === 0 && (
                <div style={{ padding: '40px 16px', textAlign: 'center', color: MUTED, fontSize: T_BASE }}>
                  No students in this batch.
                </div>
              )}

              {!loading && students.map((s, i) => (
                <div key={s.id} style={{ borderBottom: i < students.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                  <StudentRow student={s} index={i} onClick={() => goToStudent(s.id)} atRiskReasons={atRiskMap.get(s.id)} popover={atRiskPopover} />
                </div>
              ))}
            </div>

            {/* Mobile cards */}
            <div id="students-cards" style={{ flexDirection: 'column', gap: 10 }}>
              {loading && (
                <div style={{ padding: '32px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: MUTED, fontSize: T_BASE }}>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} aria-hidden />
                  Loading…
                </div>
              )}
              {!loading && students.length === 0 && (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: MUTED, fontSize: T_BASE, background: BG, border: `1px dashed ${BORDER}`, borderRadius: R_LG }}>
                  No students in this batch.
                </div>
              )}
              {!loading && students.map((s, i) => (
                <StudentCard key={s.id} student={s} index={i} onClick={() => goToStudent(s.id)} atRiskReasons={atRiskMap.get(s.id)} popover={atRiskPopover} />
              ))}
            </div>
          </>
        )}
      </div>

      <AtRiskPopover state={atRiskPopover.state} onClose={atRiskPopover.close} />
    </>
  );
}

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ClipboardList,
  CalendarCheck,
  Sparkles,
  Gauge,
  AlertTriangle,
} from 'lucide-react';
import StatCard  from '@/components/admin/analytics/StatCard';
import ChartCard from '@/components/admin/analytics/ChartCard';
import BarList   from '@/components/admin/analytics/BarList';
import { fmtNum, fmtPct } from '@/components/admin/analytics/formatters';
import StudentMetricsPanel from '@/components/students/StudentMetricsPanel';
import WhatsAppButton from './WhatsAppButton';
import { buildStatusMessage } from '@/lib/students/whatsapp-message';
import {
  RED, RED_HOVER, RED_DARK, SLATE, BORDER, BORDER_FIELD, MUTED, BG, SURFACE, SURFACE_ALT,
  INK_SOFT, OK, WARN, WARN_BG, T_XS, T_SM, T_BASE, T_XL, T_2XL,
  R_SM, R_MD, R_LG, R_PILL, FONT_HEADING,
} from '../lms/lms-shared';
import type {
  StudentDetailResponse,
  StudentTestResult,
} from '@/lib/students/progress-types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

// ─── Props ────────────────────────────────────────────────────────────────────

interface StudentDetailClientProps {
  detail: StudentDetailResponse;
}

type Tab = 'tests' | 'attendance' | 'lexicore' | 'metrics';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(p => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function attendanceColor(pct: number | null): string {
  if (pct == null) return MUTED;
  if (pct >= 80) return OK;
  if (pct >= 50) return WARN;
  return RED;
}

// ─── Motion variants ─────────────────────────────────────────────────────────

const fadeVariants: Variants = {
  hidden:  { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 380, damping: 32 } },
};

// ─── Product / batch chip ──────────────────────────────────────────────────────

function Chip({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'brand' }) {
  const brand = tone === 'brand';
  return (
    <span style={{
      display:       'inline-flex',
      alignItems:    'center',
      padding:       '2px 9px',
      borderRadius:  R_PILL,
      fontSize:      T_XS,
      fontWeight:    600,
      letterSpacing: '0.02em',
      lineHeight:    1.6,
      whiteSpace:    'nowrap',
      background:    brand ? `${RED}12` : SURFACE_ALT,
      color:         brand ? RED_DARK : INK_SOFT,
      border:        `1px solid ${brand ? `${RED}33` : BORDER}`,
    }}>
      {label}
    </span>
  );
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabButton({ label, active, onClick, icon: Icon }: { label: string; active: boolean; onClick: () => void; icon: React.ElementType }) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      style={{
        display:       'inline-flex',
        alignItems:    'center',
        gap:           6,
        padding:       '8px 16px',
        borderRadius:  R_MD,
        fontSize:      T_BASE,
        fontWeight:    active ? 600 : 500,
        cursor:        'pointer',
        border:        `1px solid ${active ? RED : BORDER_FIELD}`,
        background:    active ? `${RED}0D` : SURFACE,
        color:         active ? RED : MUTED,
        transition:    'all 0.14s ease',
        whiteSpace:    'nowrap',
      }}
    >
      <Icon size={14} aria-hidden />
      {label}
    </motion.button>
  );
}

// ─── Attendance donut (simple SVG ring) ────────────────────────────────────────

function AttendanceRing({ percent }: { percent: number | null }) {
  const size   = 96;
  const stroke = 10;
  const r      = (size - stroke) / 2;
  const circ   = 2 * Math.PI * r;
  const pct    = percent ?? 0;
  const offset = circ - (pct / 100) * circ;
  const color  = attendanceColor(percent);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={SURFACE_ALT} strokeWidth={stroke} />
        {percent != null && (
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={color} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
          />
        )}
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
      }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: SLATE, letterSpacing: '-0.02em' }}>
          {percent == null ? '—' : `${Math.round(percent)}%`}
        </span>
      </div>
    </div>
  );
}

// ─── Test row (expandable) ─────────────────────────────────────────────────────

function TestRow({ test, expanded, onToggle }: { test: StudentTestResult; expanded: boolean; onToggle: () => void }) {
  return (
    <div style={{ borderBottom: `1px solid ${BORDER}` }}>
      <div
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onToggle()}
        style={{
          display:      'grid',
          gridTemplateColumns: '2fr 90px 100px 70px 110px 32px',
          padding:      '12px 16px',
          alignItems:   'center',
          cursor:       'pointer',
          gap:          8,
        }}
      >
        <span style={{ fontSize: T_BASE, fontWeight: 600, color: SLATE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {test.title}
        </span>
        <span style={{ fontSize: T_SM, color: MUTED }}>{formatShortDate(test.takenAt)}</span>
        <span style={{ fontSize: T_SM, color: INK_SOFT }}>{test.score}/{test.totalMarks}</span>
        <span style={{ fontSize: T_BASE, fontWeight: 700, color: SLATE }}>{Math.round(test.percentage)}%</span>
        <span style={{ fontSize: T_SM, color: MUTED }}>
          Rank {test.rank}/{test.totalStudents}
        </span>
        <motion.span animate={{ rotate: expanded ? 180 : 0 }} style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <ChevronDown size={15} style={{ color: MUTED }} aria-hidden />
        </motion.span>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '4px 16px 16px', background: SURFACE_ALT }}>
              <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: T_SM, color: MUTED, flexWrap: 'wrap' }}>
                <span>Class avg: <strong style={{ color: INK_SOFT }}>{test.classAverage.toFixed(1)}</strong></span>
                <span>Top 5 avg: <strong style={{ color: INK_SOFT }}>{test.top5Average.toFixed(1)}</strong></span>
                <span>Highest: <strong style={{ color: INK_SOFT }}>{test.highest}</strong></span>
                <span>Correct: <strong style={{ color: OK }}>{test.totalCorrect}</strong></span>
                <span>Wrong: <strong style={{ color: RED_DARK }}>{test.totalWrong}</strong></span>
                <span>Unattempted: <strong style={{ color: MUTED }}>{test.totalUnattempted}</strong></span>
              </div>

              {test.sections.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {test.sections.map((s, i) => (
                    <div key={i} style={{
                      display: 'grid', gridTemplateColumns: '1.5fr 90px 60px 1fr',
                      alignItems: 'center', gap: 8,
                      padding: '8px 10px', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_SM,
                    }}>
                      <span style={{ fontSize: T_SM, fontWeight: 600, color: INK_SOFT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.title}
                      </span>
                      <span style={{ fontSize: T_SM, color: MUTED }}>{s.score}/{s.totalMarks}</span>
                      <span style={{ fontSize: T_SM, fontWeight: 700, color: SLATE }}>{Math.round(s.percentage)}%</span>
                      <span style={{ fontSize: T_XS, color: MUTED }}>
                        <span style={{ color: OK }}>{s.correct}✓</span>{' '}
                        <span style={{ color: RED_DARK }}>{s.wrong}✗</span>{' '}
                        <span>{s.unattempted} skipped</span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: T_SM, color: MUTED }}>No section breakdown available.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Tests tab ────────────────────────────────────────────────────────────────

function TestsTab({ tests, weakSections }: { tests: StudentTestResult[]; weakSections: StudentDetailResponse['weakSections'] }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const chronological = [...tests].reverse().map(t => ({
    date:       formatShortDate(t.takenAt),
    percentage: Math.round(t.percentage * 10) / 10,
  }));

  const weakItems = weakSections.map(w => ({
    label: w.title,
    value: Math.round(w.accuracyPercent),
    sub:   `${w.correct}/${w.correct + w.wrong} correct`,
  }));

  if (tests.length === 0) {
    return (
      <div style={{ background: BG, border: `1px dashed ${BORDER}`, borderRadius: R_LG, padding: '40px 24px', textAlign: 'center' }}>
        <ClipboardList size={22} style={{ color: MUTED, margin: '0 auto 8px' }} aria-hidden />
        <p style={{ margin: 0, fontSize: T_BASE, color: MUTED }}>No tests taken yet.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ChartCard title="Test Performance Over Time" sub="Percentage per attempt" minHeight={200}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chronological} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
            <XAxis dataKey="date" tick={{ fontSize: T_XS, fill: MUTED }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: T_XS, fill: MUTED }} tickLine={false} axisLine={false} domain={[0, 100]} />
            <Tooltip contentStyle={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_MD, fontSize: T_SM }} />
            <Line type="monotone" dataKey="percentage" name="Score %" stroke={RED} strokeWidth={2} dot={{ r: 3, fill: RED }} activeDot={{ r: 5, fill: RED_HOVER }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_LG, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 90px 100px 70px 110px 32px', padding: '10px 16px', background: SURFACE_ALT, borderBottom: `1px solid ${BORDER}` }}>
          {['Test', 'Date', 'Score', '%', 'Rank', ''].map(h => (
            <span key={h} style={{ fontSize: T_XS, fontWeight: 600, color: MUTED, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</span>
          ))}
        </div>
        {tests.map(t => (
          <TestRow
            key={t.testId}
            test={t}
            expanded={expandedId === t.testId}
            onToggle={() => setExpandedId(prev => prev === t.testId ? null : t.testId)}
          />
        ))}
      </div>

      {weakItems.length > 0 && (
        <ChartCard title="Weakest Areas" sub="Lowest accuracy sections across all tests">
          <BarList items={weakItems} max={100} valueFormat={v => `${v}%`} accent={RED} />
        </ChartCard>
      )}
    </div>
  );
}

// ─── Attendance tab ─────────────────────────────────────────────────────────────

function AttendanceTab({ attendance }: { attendance: StudentDetailResponse['attendance'] }) {
  if (attendance.total === 0) {
    return (
      <div style={{ background: BG, border: `1px dashed ${BORDER}`, borderRadius: R_LG, padding: '40px 24px', textAlign: 'center' }}>
        <CalendarCheck size={22} style={{ color: MUTED, margin: '0 auto 8px' }} aria-hidden />
        <p style={{ margin: 0, fontSize: T_BASE, color: MUTED }}>No attendance sessions recorded yet.</p>
      </div>
    );
  }

  const subjectItems = attendance.bySubject.map(s => ({
    label: s.subject,
    value: s.percent ?? 0,
    sub:   `${s.attended}/${s.total}`,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_LG, padding: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
        <AttendanceRing percent={attendance.overallPercent} />
        <div>
          <p style={{ margin: '0 0 4px', fontSize: T_BASE, fontWeight: 600, color: SLATE }}>Overall Attendance</p>
          <p style={{ margin: 0, fontSize: T_SM, color: MUTED }}>
            {attendance.attended} attended of {attendance.total} sessions
          </p>
        </div>
      </div>

      {subjectItems.length > 0 && (
        <ChartCard title="By Subject" sub="Attendance percentage per subject">
          <BarList items={subjectItems} max={100} valueFormat={v => `${Math.round(v)}%`} />
        </ChartCard>
      )}

      <ChartCard title="Recent Sessions" empty={attendance.recent.length === 0} emptyNote="No recent sessions.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {attendance.recent.map(s => (
            <div key={s.sessionId} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              padding: '9px 12px', background: SURFACE_ALT, border: `1px solid ${BORDER}`, borderRadius: 7,
            }}>
              <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                {s.attended
                  ? <CheckCircle2 size={15} style={{ color: OK, flexShrink: 0 }} aria-hidden />
                  : <XCircle size={15} style={{ color: RED, flexShrink: 0 }} aria-hidden />}
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: T_SM, fontWeight: 600, color: INK_SOFT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.title}
                  </p>
                  <p style={{ margin: 0, fontSize: T_XS, color: MUTED }}>{s.subject}</p>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ margin: 0, fontSize: T_XS, color: MUTED }}>{formatShortDate(s.scheduledAt)}</p>
                {s.attended && s.mode && <p style={{ margin: 0, fontSize: 10, color: MUTED }}>{s.mode}</p>}
              </div>
            </div>
          ))}
        </div>
      </ChartCard>
    </div>
  );
}

// ─── LexiCore tab ───────────────────────────────────────────────────────────────

function LexicoreTab({ lexicore }: { lexicore: StudentDetailResponse['lexicore'] }) {
  if (!lexicore.hasProgress) {
    return (
      <div style={{ background: BG, border: `1px dashed ${BORDER}`, borderRadius: R_LG, padding: '40px 24px', textAlign: 'center' }}>
        <Sparkles size={22} style={{ color: MUTED, margin: '0 auto 8px' }} aria-hidden />
        <p style={{ margin: 0, fontSize: T_BASE, color: MUTED }}>Hasn&apos;t started LexiCore yet.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <StatCard label="Total LexiCore Points" value={fmtNum(lexicore.totalPoints)} accent />

      <div className="student-stat-band" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', border: `1px solid ${BORDER}`, borderRadius: R_LG, overflow: 'hidden' }}>
        <StatCard label="Quiz Points"        value={fmtNum(lexicore.quizPoints)} />
        <StatCard label="Word Points"        value={fmtNum(lexicore.wordPoints)} />
        <StatCard label="Quizzes Completed"  value={fmtNum(lexicore.quizzesCompleted)} />
        <StatCard label="Quiz Accuracy"      value={fmtPct(lexicore.quizAccuracy)} />
        <StatCard label="Words Mastered"     value={fmtNum(lexicore.wordsMastered)} />
        <StatCard label="Words Seen"         value={fmtNum(lexicore.wordsSeen)} />
        <StatCard label="Current Streak"     value={`${lexicore.streakDays}d`} />
        <StatCard label="Longest Streak"     value={`${lexicore.longestStreak}d`} />
        <StatCard label="Points This Week"   value={fmtNum(lexicore.weeklyPoints)} />
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function StudentDetailClient({ detail }: StudentDetailClientProps) {
  const { profile, overview, tests, weakSections, attendance, lexicore } = detail;
  const [tab, setTab] = useState<Tab>('tests');

  const whatsappMessage = detail.metrics
    ? buildStatusMessage({ studentName: profile.name, metrics: detail.metrics, atRisk: detail.atRisk ?? { atRisk: false, reasons: [] } })
    : `Hi, checking in on ${profile.name}'s progress at VH.`;

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto' }}>
      <style>{`
        .student-stat-band > div { border: 0 !important; border-radius: 0 !important; }
        .student-stat-band > div + div { border-left: 1px solid ${BORDER} !important; }
        .student-stat-band > div > span:first-child { color: ${MUTED} !important; font-size: ${T_SM}px !important; }
        .student-stat-band > div > span:nth-child(2) { color: ${INK_SOFT} !important; font-size: ${T_2XL}px !important; }
      `}</style>

      {/* Back link */}
      <Link href="/admin/students" style={{ textDecoration: 'none' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: T_BASE, color: MUTED, fontWeight: 500, marginBottom: 16 }}>
          <ArrowLeft size={14} aria-hidden /> Back to Students
        </span>
      </Link>

      {/* Profile header */}
      <motion.div
        variants={fadeVariants}
        initial="hidden"
        animate="visible"
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:          16,
          marginBottom: 24,
          paddingBottom: 24,
          borderBottom: `1px solid ${BORDER}`,
          flexWrap:     'wrap',
        }}
      >
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: RED, color: SURFACE,
          fontSize: 18, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, letterSpacing: '0.04em',
        }}>
          {getInitials(profile.name || 'S')}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ margin: 0, fontFamily: FONT_HEADING, fontSize: T_XL, fontWeight: 700, color: SLATE, letterSpacing: '-0.03em' }}>
            {profile.name}
          </h1>
          <p style={{ margin: '2px 0 8px', fontSize: T_BASE, color: MUTED }}>{profile.email}</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {profile.studentId && <Chip label={profile.studentId} tone="brand" />}
            {profile.batch && <Chip label={profile.batch} />}
            {profile.products.map(p => <Chip key={p} label={p.toUpperCase()} />)}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: T_XS, color: MUTED }}>
              <Calendar size={11} aria-hidden /> Joined {formatDate(profile.joinedAt)}
            </span>
          </div>
        </div>
        <WhatsAppButton whatsapp={profile.whatsapp} message={whatsappMessage} />
      </motion.div>

      {/* At-risk banner */}
      {detail.atRisk?.atRisk && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: WARN_BG, border: `1px solid ${WARN}40`, borderRadius: R_LG,
          padding: '12px 16px', marginBottom: 24,
        }}>
          <AlertTriangle size={16} style={{ color: WARN, flexShrink: 0, marginTop: 1 }} aria-hidden />
          <div>
            <p style={{ margin: '0 0 4px', fontSize: T_BASE, fontWeight: 700, color: WARN }}>At risk</p>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: T_SM, color: INK_SOFT }}>
              {detail.atRisk.reasons.map(r => <li key={r.code}>{r.message}</li>)}
            </ul>
          </div>
        </div>
      )}

      {/* Overview KPI strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        border: `1px solid ${BORDER}`,
        borderRadius: R_LG,
        overflow: 'hidden',
        marginBottom: 28,
      }} className="student-stat-band">
        <StatCard label="Attendance"    value={fmtPct(overview.attendancePercent, 0)} sub={`${overview.attendedSessions}/${overview.totalSessions} sessions`} />
        <StatCard label="Tests Taken"   value={fmtNum(overview.testsTaken)} />
        <StatCard label="Avg Test %"    value={fmtPct(overview.avgTestPercentage, 0)} accent />
        <StatCard label="Best Rank"     value={overview.bestRank != null ? `#${overview.bestRank}` : '—'} />
        <StatCard label="LexiCore Pts"  value={fmtNum(overview.lexicorePoints)} />
        <StatCard label="Words Mastered" value={fmtNum(overview.wordsMastered)} />
        <StatCard label="Streak"        value={`${overview.streakDays}d`} />
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <TabButton label="Tests"       icon={ClipboardList} active={tab === 'tests'}      onClick={() => setTab('tests')} />
        <TabButton label="Attendance"  icon={CalendarCheck} active={tab === 'attendance'} onClick={() => setTab('attendance')} />
        <TabButton label="LexiCore"    icon={Sparkles}      active={tab === 'lexicore'}   onClick={() => setTab('lexicore')} />
        <TabButton label="Progress Metrics" icon={Gauge}    active={tab === 'metrics'}    onClick={() => setTab('metrics')} />
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16 }}
        >
          {tab === 'tests'      && <TestsTab tests={tests} weakSections={weakSections} />}
          {tab === 'attendance' && <AttendanceTab attendance={attendance} />}
          {tab === 'lexicore'   && <LexicoreTab lexicore={lexicore} />}
          {tab === 'metrics'    && (
            detail.metrics
              ? <StudentMetricsPanel metrics={detail.metrics} lexicore={lexicore} />
              : (
                <div style={{ background: BG, border: `1px dashed ${BORDER}`, borderRadius: R_LG, padding: '40px 24px', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: T_BASE, color: MUTED }}>Metrics unavailable.</p>
                </div>
              )
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

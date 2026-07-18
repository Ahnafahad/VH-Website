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
} from 'lucide-react';
import StatCard  from '@/components/admin/analytics/StatCard';
import ChartCard from '@/components/admin/analytics/ChartCard';
import BarList   from '@/components/admin/analytics/BarList';
import { fmtNum, fmtPct } from '@/components/admin/analytics/formatters';
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

type Tab = 'tests' | 'attendance' | 'lexicore';

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
  if (pct == null) return '#9CA3AF';
  if (pct >= 80) return '#10B981';
  if (pct >= 50) return '#F59E0B';
  return '#EF4444';
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
      borderRadius:  100,
      fontSize:      11,
      fontWeight:    600,
      letterSpacing: '0.02em',
      lineHeight:    1.6,
      whiteSpace:    'nowrap',
      background:    brand ? 'rgba(214,43,56,0.07)' : '#F3F4F6',
      color:         brand ? '#B91C2C' : '#374151',
      border:        brand ? '1px solid rgba(214,43,56,0.2)' : '1px solid #E5E7EB',
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
        borderRadius:  8,
        fontSize:      13,
        fontWeight:    active ? 600 : 500,
        cursor:        'pointer',
        border:        active ? '1.5px solid #D62B38' : '1.5px solid #E5E7EB',
        background:    active ? 'rgba(214,43,56,0.05)' : '#FFFFFF',
        color:         active ? '#D62B38' : '#6B7280',
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
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F3F4F6" strokeWidth={stroke} />
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
        <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.02em' }}>
          {percent == null ? '—' : `${Math.round(percent)}%`}
        </span>
      </div>
    </div>
  );
}

// ─── Test row (expandable) ─────────────────────────────────────────────────────

function TestRow({ test, expanded, onToggle }: { test: StudentTestResult; expanded: boolean; onToggle: () => void }) {
  return (
    <div style={{ borderBottom: '1px solid #F9FAFB' }}>
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
        <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {test.title}
        </span>
        <span style={{ fontSize: 12, color: '#6B7280' }}>{formatShortDate(test.takenAt)}</span>
        <span style={{ fontSize: 12, color: '#374151' }}>{test.score}/{test.totalMarks}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{Math.round(test.percentage)}%</span>
        <span style={{ fontSize: 12, color: '#6B7280' }}>
          Rank {test.rank}/{test.totalStudents}
        </span>
        <motion.span animate={{ rotate: expanded ? 180 : 0 }} style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <ChevronDown size={15} style={{ color: '#9CA3AF' }} aria-hidden />
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
            <div style={{ padding: '4px 16px 16px', background: '#FAFAFA' }}>
              <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 12, color: '#6B7280', flexWrap: 'wrap' }}>
                <span>Class avg: <strong style={{ color: '#374151' }}>{test.classAverage.toFixed(1)}</strong></span>
                <span>Top 5 avg: <strong style={{ color: '#374151' }}>{test.top5Average.toFixed(1)}</strong></span>
                <span>Highest: <strong style={{ color: '#374151' }}>{test.highest}</strong></span>
                <span>Correct: <strong style={{ color: '#047857' }}>{test.totalCorrect}</strong></span>
                <span>Wrong: <strong style={{ color: '#B91C1C' }}>{test.totalWrong}</strong></span>
                <span>Unattempted: <strong style={{ color: '#9CA3AF' }}>{test.totalUnattempted}</strong></span>
              </div>

              {test.sections.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {test.sections.map((s, i) => (
                    <div key={i} style={{
                      display: 'grid', gridTemplateColumns: '1.5fr 90px 60px 1fr',
                      alignItems: 'center', gap: 8,
                      padding: '8px 10px', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 6,
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.title}
                      </span>
                      <span style={{ fontSize: 12, color: '#6B7280' }}>{s.score}/{s.totalMarks}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{Math.round(s.percentage)}%</span>
                      <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                        <span style={{ color: '#047857' }}>{s.correct}✓</span>{' '}
                        <span style={{ color: '#B91C1C' }}>{s.wrong}✗</span>{' '}
                        <span>{s.unattempted} skipped</span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF' }}>No section breakdown available.</p>
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
      <div style={{ background: '#FAFAFA', border: '1px dashed #E5E7EB', borderRadius: 10, padding: '40px 24px', textAlign: 'center' }}>
        <ClipboardList size={22} style={{ color: '#D1D5DB', margin: '0 auto 8px' }} aria-hidden />
        <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF' }}>No tests taken yet.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ChartCard title="Test Performance Over Time" sub="Percentage per attempt" minHeight={200}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chronological} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} domain={[0, 100]} />
            <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '12px' }} />
            <Line type="monotone" dataKey="percentage" name="Score %" stroke="#D62B38" strokeWidth={2} dot={{ r: 3, fill: '#D62B38' }} activeDot={{ r: 5, fill: '#D62B38' }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 90px 100px 70px 110px 32px', padding: '10px 16px', background: '#FAFAFA', borderBottom: '1px solid #F3F4F6' }}>
          {['Test', 'Date', 'Score', '%', 'Rank', ''].map(h => (
            <span key={h} style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</span>
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
          <BarList items={weakItems} max={100} valueFormat={v => `${v}%`} accent="#EF4444" />
        </ChartCard>
      )}
    </div>
  );
}

// ─── Attendance tab ─────────────────────────────────────────────────────────────

function AttendanceTab({ attendance }: { attendance: StudentDetailResponse['attendance'] }) {
  if (attendance.total === 0) {
    return (
      <div style={{ background: '#FAFAFA', border: '1px dashed #E5E7EB', borderRadius: 10, padding: '40px 24px', textAlign: 'center' }}>
        <CalendarCheck size={22} style={{ color: '#D1D5DB', margin: '0 auto 8px' }} aria-hidden />
        <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF' }}>No attendance sessions recorded yet.</p>
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
      <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, padding: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
        <AttendanceRing percent={attendance.overallPercent} />
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: '#0F172A' }}>Overall Attendance</p>
          <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF' }}>
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
              padding: '9px 12px', background: '#FAFAFA', border: '1px solid #E5E7EB', borderRadius: 7,
            }}>
              <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                {s.attended
                  ? <CheckCircle2 size={15} style={{ color: '#10B981', flexShrink: 0 }} aria-hidden />
                  : <XCircle size={15} style={{ color: '#EF4444', flexShrink: 0 }} aria-hidden />}
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.title}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF' }}>{s.subject}</p>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ margin: 0, fontSize: 11, color: '#6B7280' }}>{formatShortDate(s.scheduledAt)}</p>
                {s.attended && s.mode && <p style={{ margin: 0, fontSize: 10, color: '#9CA3AF' }}>{s.mode}</p>}
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
      <div style={{ background: '#FAFAFA', border: '1px dashed #E5E7EB', borderRadius: 10, padding: '40px 24px', textAlign: 'center' }}>
        <Sparkles size={22} style={{ color: '#D1D5DB', margin: '0 auto 8px' }} aria-hidden />
        <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF' }}>Hasn&apos;t started LexiCore yet.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <StatCard label="Total LexiCore Points" value={fmtNum(lexicore.totalPoints)} accent />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
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

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto' }}>

      {/* Back link */}
      <Link href="/admin/students" style={{ textDecoration: 'none' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6B7280', fontWeight: 500, marginBottom: 16 }}>
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
          borderBottom: '1px solid #F3F4F6',
          flexWrap:     'wrap',
        }}
      >
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: '#D62B38', color: '#FFFFFF',
          fontSize: 18, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, letterSpacing: '0.04em',
        }}>
          {getInitials(profile.name || 'S')}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.03em' }}>
            {profile.name}
          </h1>
          <p style={{ margin: '2px 0 8px', fontSize: 13, color: '#6B7280' }}>{profile.email}</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {profile.studentId && <Chip label={profile.studentId} tone="brand" />}
            {profile.batch && <Chip label={profile.batch} />}
            {profile.products.map(p => <Chip key={p} label={p.toUpperCase()} />)}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#9CA3AF' }}>
              <Calendar size={11} aria-hidden /> Joined {formatDate(profile.joinedAt)}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Overview KPI strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 12,
        marginBottom: 28,
      }}>
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
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

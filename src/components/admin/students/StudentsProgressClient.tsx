'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, MessageCircle, Search, Users, X } from 'lucide-react';
import type { AttendanceTick, BatchOption, HomeworkState, StudentSummary } from '@/lib/students/progress-types';
import type { AtRiskBadgeReason } from '@/components/admin/lms/lms-shared';
import { SPIN_CSS, useDialogBehaviour } from '@/components/admin/lms/lms-shared';
import {
  RED, SLATE, BORDER, BORDER_FIELD, MUTED, BG, SURFACE, SURFACE_ALT, INK_SOFT, OK, WARN, WARN_BG, INFO, INFO_BG,
  T_XS, T_SM, T_BASE, T_MD, T_XL, R_SM, R_MD, R_LG, R_PILL, SHADOW_LG, Z_MODAL, Z_MODAL_BACKDROP, FONT_HEADING,
} from '@/components/admin/lms/tokens';
import { Sparkline } from '@/components/admin/lms/Sparkline';
import {
  buildMapPoints, computeMarkDomain, describeHomework, describeTicks, filterAndSortStudents, matchesQuery,
  type SortDir, type SortKey,
} from '@/lib/students/progress-pure';
import { buildWhatsAppLink } from '@/lib/students/whatsapp-link';
import { buildCheckInMessage } from '@/lib/students/whatsapp-message';

// ─── Props ────────────────────────────────────────────────────────────────────

interface AtRiskStudentProp {
  id:      number;
  reasons: AtRiskBadgeReason[];
}

interface StudentsProgressClientProps {
  initialBatches:  BatchOption[];
  initialBatch:    string | null;
  initialStudents: StudentSummary[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

const CSS = `
.pg-fchip{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 12px;border:1px solid ${BORDER_FIELD};border-radius:${R_PILL}px;background:${SURFACE};color:${INK_SOFT};font-size:${T_BASE}px;cursor:pointer;white-space:nowrap;transition:background-color .14s,border-color .14s}
.pg-fchip[aria-pressed="true"]{border-color:${RED};background:${RED}0D;color:${RED};font-weight:600}
.pg-fchip:hover{border-color:${MUTED}}
.pg-fchip:focus-visible,.pg-sortbtn:focus-visible,.pg-name:focus-visible,.pg-dot:focus-visible,.pg-link:focus-visible{outline:2px solid ${RED};outline-offset:2px}
.pg-row{cursor:pointer}
.pg-row:hover td{background:${SURFACE_ALT}}
.pg-row[data-sel="true"] td{background:${INFO_BG}}
.pg-name{border:0;background:none;padding:0;font:inherit;font-weight:600;color:${INK_SOFT};cursor:pointer;text-align:left}
.pg-sortbtn{border:0;background:none;padding:4px 0;font:inherit;color:inherit;letter-spacing:inherit;text-transform:inherit;cursor:pointer}
.pg-sortbtn:hover{color:${INK_SOFT}}
.pg-tk{display:inline-flex;gap:2px;align-items:flex-end;height:16px}
.pg-tk i{display:block;width:8px;border-radius:2px;background:${OK};height:16px}
.pg-tk i.o{background:${INFO};height:10px}
.pg-tk i.a{background:transparent;border:1.5px solid ${RED};height:16px}
.pg-hq{display:inline-flex;gap:2px}
.pg-hq i{display:block;width:11px;height:11px;border-radius:2px;border:1.5px solid ${BORDER_FIELD}}
.pg-hq i.r{background:${SLATE};border-color:${SLATE}}
.pg-hq i.s{background:${WARN_BG};border-color:${WARN}}
.pg-hq i.m{border-style:dashed}
.pg-map{position:relative;height:340px;border-bottom:1px solid ${BORDER_FIELD};border-left:1px solid ${BORDER_FIELD};margin:16px 24px 52px 52px;background:linear-gradient(${BORDER} 1px,transparent 1px) 0 0/100% 25%,linear-gradient(90deg,${BORDER} 1px,transparent 1px) 0 0/25% 100%}
.pg-dot{position:absolute;width:28px;height:28px;padding:0;border:0;background:none;border-radius:50%;transform:translate(-50%,50%);cursor:pointer;transition:transform .12s ease-out}
.pg-dot>b{position:absolute;left:7px;top:7px;width:14px;height:14px;border-radius:50%;background:${INFO};border:2px solid ${SURFACE}}
.pg-dot.risk>b{background:${RED}}
.pg-dot:hover,.pg-dot.hit,.pg-dot:focus-visible{transform:translate(-50%,50%) scale(1.4);z-index:3}
.pg-dot.dim{opacity:.25}
.pg-dot>span{display:none;position:absolute;top:2px;left:26px;white-space:nowrap;font-size:${T_XS}px;color:${SLATE};background:${SURFACE};padding:0 4px;border-radius:3px;border:1px solid ${BORDER}}
.pg-dot.flip>span{left:auto;right:26px}
.pg-dot:hover>span,.pg-dot.hit>span,.pg-dot:focus-visible>span{display:block}
.pg-ax{position:absolute;font-size:10.5px;color:${MUTED};font-variant-numeric:tabular-nums}
.pg-drawer{position:fixed;top:0;right:0;bottom:0;width:min(380px,100vw);background:${SURFACE};border-left:1px solid ${BORDER};box-shadow:${SHADOW_LG};z-index:${Z_MODAL};display:flex;flex-direction:column;animation:pg-in .18s ease-out}
@keyframes pg-in{from{transform:translateX(24px);opacity:0}to{transform:none;opacity:1}}
@media (pointer:coarse){.pg-fchip,.pg-sortbtn{min-height:44px}.pg-dot{width:44px;height:44px}.pg-dot>b{left:15px;top:15px}.pg-dot>span{top:10px;left:40px}.pg-dot.flip>span{right:40px}}
@media (prefers-reduced-motion:reduce){.pg-drawer{animation:none}.pg-fchip,.pg-dot{transition-duration:.01ms}}
@media (max-width:640px){.pg-map{margin:16px 12px 52px 44px}}
`;

// ─── Marks ────────────────────────────────────────────────────────────────────

function Ticks({ ticks }: { ticks: AttendanceTick[] }) {
  if (ticks.length === 0) return <span style={{ color: MUTED, fontSize: T_SM }}>{'—'}</span>;
  return (
    <span className="pg-tk" role="img" aria-label={describeTicks(ticks)}>
      {ticks.map((t, i) => (
        <i key={i} className={t === 'online' ? 'o' : t === 'absent' ? 'a' : ''} title={t === 'present' ? 'Present' : t === 'online' ? 'Online' : 'Absent'} />
      ))}
    </span>
  );
}

function Squares({ states }: { states: HomeworkState[] }) {
  if (states.length === 0) return <span style={{ color: MUTED, fontSize: T_SM }}>{'—'}</span>;
  return (
    <span className="pg-hq" role="img" aria-label={describeHomework(states)}>
      {states.map((h, i) => (
        <i key={i} className={h === 'reviewed' ? 'r' : h === 'waiting' ? 's' : 'm'} title={h === 'reviewed' ? 'Reviewed' : h === 'waiting' ? 'Waiting for review' : 'Missing'} />
      ))}
    </span>
  );
}

function Legend() {
  const item = (node: React.ReactNode, text: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{node} {text}</span>
  );
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', padding: '10px 16px', borderTop: `1px solid ${BORDER}`, fontSize: T_XS, color: MUTED }}>
      {item(<span className="pg-tk"><i /></span>, 'present')}
      {item(<span className="pg-tk"><i className="o" /></span>, 'online')}
      {item(<span className="pg-tk"><i className="a" /></span>, 'absent')}
      {item(<span className="pg-hq"><i className="r" /></span>, 'homework reviewed')}
      {item(<span className="pg-hq"><i className="s" /></span>, 'waiting')}
      {item(<span className="pg-hq"><i className="m" /></span>, 'missing')}
    </div>
  );
}

// ─── Side panel ───────────────────────────────────────────────────────────────

function StudentPanel({ student, atRisk, onClose }: {
  student: StudentSummary; atRisk: AtRiskBadgeReason[] | undefined; onClose: () => void;
}) {
  const ref = useDialogBehaviour(true, onClose);
  const link = buildWhatsAppLink(student.whatsapp, buildCheckInMessage(student.name));
  const att = student.attendancePercent;
  const heading = `panel-title-${student.id}`;
  const eyebrow: React.CSSProperties = { margin: '16px 0 6px', fontSize: T_XS, fontWeight: 600, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase' };

  return (
    <>
      <div onClick={onClose} aria-hidden style={{ position: 'fixed', inset: 0, background: `${SLATE}40`, zIndex: Z_MODAL_BACKDROP }} />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={heading} tabIndex={-1} className="pg-drawer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: `1px solid ${BORDER}` }}>
          <span aria-hidden style={{ width: 34, height: 34, borderRadius: '50%', background: SURFACE_ALT, color: INK_SOFT, fontSize: T_XS, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {getInitials(student.name || 'S')}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 id={heading} style={{ margin: 0, fontFamily: FONT_HEADING, fontSize: T_MD + 2, fontWeight: 600, color: SLATE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {student.name}
            </h2>
            <p style={{ margin: 0, fontSize: T_XS, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {student.studentId ?? student.email}
            </p>
          </div>
          <button
            type="button" onClick={onClose} aria-label="Close panel" className="lms-iconbtn"
            style={{ width: 36, height: 36, border: `1px solid ${BORDER}`, borderRadius: R_MD, background: SURFACE, color: INK_SOFT, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <div style={{ padding: '4px 16px 16px', overflowY: 'auto', flex: 1 }}>
          {atRisk && (
            <div style={{ marginTop: 14, padding: '8px 12px', borderLeft: `3px solid ${RED}`, background: WARN_BG, fontSize: T_SM, color: INK_SOFT }}>
              <b style={{ color: RED }}>At risk. </b>
              {atRisk.map(r => r.message).join(' ')}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
            {[
              { v: att == null ? '—' : `${Math.round(att)}%`, l: 'Present', s: student.totalSessions ? `${student.attendedSessions} of ${student.totalSessions} classes` : 'No classes yet' },
              { v: student.avgTestPercentage == null ? '—' : String(Math.round(student.avgTestPercentage)), l: 'Average mark', s: `${student.testsTaken} ${student.testsTaken === 1 ? 'test' : 'tests'}` },
            ].map(x => (
              <div key={x.l} style={{ border: `1px solid ${BORDER}`, borderRadius: R_MD, padding: '10px 12px' }}>
                <div style={{ fontFamily: 'var(--font-math-mono), ui-monospace, monospace', fontSize: T_XL, fontWeight: 600, color: SLATE }}>{x.v}</div>
                <div style={{ fontSize: T_XS, color: MUTED }}>{x.l} &middot; {x.s}</div>
              </div>
            ))}
          </div>

          <p style={eyebrow}>Last 8 classes</p>
          <Ticks ticks={student.recentAttendance} />

          <p style={eyebrow}>Homework ({student.homeworkSubmitted} of {student.homeworkDue} handed in)</p>
          <Squares states={student.recentHomework} />

          <p style={eyebrow}>Last tests</p>
          {student.recentMarks.length === 0 ? (
            <span style={{ fontSize: T_SM, color: MUTED }}>No tests taken yet.</span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Sparkline values={student.recentMarks} width={96} height={28} label={`Marks: ${student.recentMarks.join(', ')}`} />
              <span style={{ fontFamily: 'var(--font-math-mono), ui-monospace, monospace', fontSize: T_BASE, color: INK_SOFT }}>
                {student.recentMarks.join(' → ')}
              </span>
            </div>
          )}
          {student.lastTest && (
            <p style={{ margin: '8px 0 0', fontSize: T_SM, color: MUTED }}>
              Latest: {student.lastTest.title}, {Math.round(student.lastTest.percentage)}%
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: `1px solid ${BORDER}` }}>
          {link.ok && (
            <a
              href={link.url} target="_blank" rel="noopener noreferrer" className="pg-link"
              style={{ flex: 1, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: R_MD, background: RED, color: SURFACE, fontSize: T_BASE, fontWeight: 600, textDecoration: 'none' }}
            >
              <MessageCircle size={14} aria-hidden /> Message
            </a>
          )}
          <Link
            href={`/admin/students/${student.id}`} className="pg-link"
            style={{ flex: 1, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: R_MD, border: `1px solid ${BORDER_FIELD}`, color: INK_SOFT, fontSize: T_BASE, fontWeight: 600, textDecoration: 'none' }}
          >
            Full profile
          </Link>
        </div>
      </div>
    </>
  );
}

// ─── Cohort map ───────────────────────────────────────────────────────────────

function CohortMap({ students, query, riskIds, onOpen }: {
  students: StudentSummary[]; query: string; riskIds: ReadonlySet<number>; onOpen: (id: number) => void;
}) {
  const domain = useMemo(
    () => computeMarkDomain(students.map(s => s.avgTestPercentage).filter((v): v is number => v != null)),
    [students],
  );
  const { points, unplotted } = useMemo(() => buildMapPoints(students, domain), [students, domain]);
  const searching = query.trim().length > 0;

  if (points.length === 0) {
    return <p style={{ padding: '32px 16px', margin: 0, textAlign: 'center', color: MUTED, fontSize: T_BASE }}>Nobody to plot yet. A student needs at least one completed class and one test.</p>;
  }

  return (
    <div>
      <div className="pg-map" role="group" aria-label="Attendance against average mark, one dot per student">
        <span className="pg-ax" style={{ left: 8, bottom: 8, color: RED, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Watch</span>
        <span className="pg-ax" style={{ right: 8, top: 8, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Strong</span>
        {[0, 50, 100].map(v => (
          <span key={v} className="pg-ax" style={{ left: `${v}%`, bottom: -20, transform: `translateX(-${v / 2}%)` }}>{v}%</span>
        ))}
        {domain.ticks.map(v => (
          <span key={v} className="pg-ax" style={{ left: -34, bottom: `${((v - domain.lo) / (domain.hi - domain.lo)) * 100}%`, transform: 'translateY(50%)' }}>{v}</span>
        ))}
        {points.map(({ student: s, x, y }) => {
          const hit = searching && matchesQuery(s, query);
          const cls = ['pg-dot', riskIds.has(s.id) ? 'risk' : '', hit ? 'hit' : '', searching && !hit ? 'dim' : '', x > 70 ? 'flip' : ''].filter(Boolean).join(' ');
          const att = Math.round(s.attendancePercent ?? 0);
          const avg = Math.round(s.avgTestPercentage ?? 0);
          return (
            <button
              key={s.id} type="button" className={cls}
              style={{ left: `${x}%`, bottom: `${y}%` }}
              onClick={() => onOpen(s.id)}
              aria-label={`${s.name}, ${att}% present, average ${avg}${riskIds.has(s.id) ? ', at risk' : ''}. Open details`}
            >
              <b />
              <span>{s.name} &middot; {att}% &middot; {avg}</span>
            </button>
          );
        })}
        <span className="pg-ax" style={{ left: '50%', bottom: -42, transform: 'translateX(-50%)' }}>Attendance, all completed classes</span>
        <span className="pg-ax" style={{ left: -52, top: -20 }}>Average mark</span>
      </div>
      <p style={{ margin: 0, padding: '0 16px 12px', fontSize: T_XS, color: MUTED }}>
        Red dot = at risk. Hover or focus a dot for the name; press Enter to open details.
        {unplotted > 0 ? ` ${unplotted} ${unplotted === 1 ? 'student' : 'students'} not shown (no classes or tests yet).` : ''}
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StudentsProgressClient({
  initialBatches,
  initialBatch,
  initialStudents,
}: StudentsProgressClientProps) {
  const [batches]  = useState<BatchOption[]>(initialBatches);
  const [batch, setBatch]       = useState<string>(initialBatch ?? '');
  const [students, setStudents] = useState<StudentSummary[]>(initialStudents);
  const [loading, setLoading]   = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery]       = useState('');
  const [onlyRisk, setOnlyRisk] = useState(false);
  const [view, setView]         = useState<'list' | 'map'>('list');
  const [sortKey, setSortKey]   = useState<SortKey>('name');
  const [dir, setDir]           = useState<SortDir>('asc');
  const [openId, setOpenId]     = useState<number | null>(null);

  // Fetched client-side after mount: the at-risk scan fans out a heavy
  // per-student metrics read. See src/app/api/admin/students/at-risk/route.ts.
  const [atRiskStudents, setAtRiskStudents] = useState<AtRiskStudentProp[]>([]);
  const [atRiskFailed, setAtRiskFailed] = useState(false);
  useEffect(() => {
    fetch('/api/admin/students/at-risk')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setAtRiskStudents(data.atRiskStudents); else setAtRiskFailed(true); })
      .catch(() => setAtRiskFailed(true));
  }, []);
  const atRiskMap = useMemo(() => {
    const m = new Map<number, AtRiskBadgeReason[]>();
    for (const s of atRiskStudents) m.set(s.id, s.reasons);
    return m;
  }, [atRiskStudents]);
  const riskIds = useMemo(() => new Set(atRiskMap.keys()), [atRiskMap]);

  const fetchBatch = async (b: string) => {
    if (!b || b === batch) { setBatch(b); return; }
    setBatch(b);
    setOpenId(null);
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

  const rows = useMemo(
    () => filterAndSortStudents(students, { query, onlyRisk, riskIds, sortKey, dir }),
    [students, query, onlyRisk, riskIds, sortKey, dir],
  );
  const openStudent = openId == null ? null : students.find(s => s.id === openId) ?? null;

  const sortBy = (k: SortKey) => {
    if (k === sortKey) setDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setDir(k === 'name' ? 'asc' : 'desc'); }
  };
  const th = (k: SortKey, label: string, align: 'left' | 'right' = 'left') => (
    <th scope="col" aria-sort={sortKey === k ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'} style={{ textAlign: align }}>
      <button type="button" className="pg-sortbtn" onClick={() => sortBy(k)}>
        {label}{sortKey === k ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );

  const thStyle = `
    .pg-table{width:100%;min-width:760px;border-collapse:collapse;font-size:${T_BASE}px}
    .pg-table th{padding:10px 14px;background:${SURFACE_ALT};border-bottom:1px solid ${BORDER};font-size:${T_XS}px;font-weight:600;color:${MUTED};letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
    .pg-table td{padding:10px 14px;border-bottom:1px solid ${BORDER};vertical-align:middle;background:${SURFACE}}
    .pg-table .num{text-align:right;font-family:var(--font-math-mono),ui-monospace,monospace;font-variant-numeric:tabular-nums}
  `;

  return (
    <>
      <style>{SPIN_CSS}</style>
      <style>{CSS}</style>
      <style>{thStyle}</style>

      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontFamily: FONT_HEADING, fontSize: T_XL, fontWeight: 700, color: SLATE, letterSpacing: '-0.04em', lineHeight: 1.2 }}>
            Students Progress
          </h1>
          {atRiskFailed && (
            <p role="alert" style={{ margin: '8px 0 0', fontSize: T_SM, color: WARN }}>
              At-risk flags could not be loaded (the scan timed out). Reload to retry.
            </p>
          )}
        </div>

        {batches.length === 0 ? (
          <div style={{ background: BG, border: `1px dashed ${BORDER}`, borderRadius: R_LG, padding: '40px 24px', textAlign: 'center' }}>
            <Users size={22} style={{ color: MUTED, margin: '0 auto 8px' }} aria-hidden />
            <p style={{ margin: 0, fontSize: T_BASE, color: MUTED }}>No batches found.</p>
          </div>
        ) : (
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_LG, overflow: 'hidden' }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: `1px solid ${BORDER}` }}>
              <div role="group" aria-label="Batch" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {batches.map(b => (
                  <button key={b.batch} type="button" className="pg-fchip" aria-pressed={b.batch === batch} onClick={() => void fetchBatch(b.batch)}>
                    {b.batch}
                    <span style={{ fontSize: T_XS, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>{b.studentCount}</span>
                  </button>
                ))}
              </div>
              <span style={{ flex: 1 }} />
              <div role="group" aria-label="View" style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="pg-fchip" aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
                <button type="button" className="pg-fchip" aria-pressed={view === 'map'} onClick={() => setView('map')}>Map</button>
              </div>
              <button type="button" className="pg-fchip" aria-pressed={onlyRisk} onClick={() => setOnlyRisk(v => !v)}>
                At risk only{riskIds.size > 0 ? ` (${riskIds.size})` : ''}
              </button>
              <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Search students by name or email</span>
                <Search size={14} aria-hidden style={{ position: 'absolute', left: 10, color: MUTED, pointerEvents: 'none' }} />
                <input
                  type="search" value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Search name or email" className="lms-field"
                  style={{ minHeight: 34, width: 220, padding: '0 10px 0 30px', border: `1px solid ${BORDER_FIELD}`, borderRadius: R_MD, background: SURFACE, color: INK_SOFT, fontSize: T_BASE }}
                />
              </label>
            </div>
            {loadError && (
              <p role="alert" style={{ margin: 0, padding: '8px 14px', fontSize: T_SM, color: RED }}>
                Couldn&apos;t load that batch. Showing previous results. Try again.
              </p>
            )}

            {loading ? (
              <div role="status" style={{ padding: 32, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, color: MUTED, fontSize: T_BASE }}>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} aria-hidden /> Loading&hellip;
              </div>
            ) : view === 'map' ? (
              <CohortMap students={rows} query={query} riskIds={riskIds} onOpen={setOpenId} />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="pg-table">
                  <thead>
                    <tr>
                      {th('name', 'Student')}
                      <th scope="col">Last 8 classes</th>
                      {th('attendance', 'Attendance', 'right')}
                      <th scope="col">Homework</th>
                      {th('avg', 'Marks', 'right')}
                      <th scope="col">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(s => (
                      <tr key={s.id} className="pg-row" data-sel={openId === s.id} onClick={() => setOpenId(s.id)}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <span aria-hidden style={{ width: 30, height: 30, borderRadius: '50%', background: SURFACE_ALT, color: INK_SOFT, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {getInitials(s.name || 'S')}
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <button type="button" className="pg-name" aria-haspopup="dialog" onClick={e => { e.stopPropagation(); setOpenId(s.id); }}>
                                {s.name}
                              </button>
                              {atRiskMap.has(s.id) && (
                                <span style={{ marginLeft: 8, fontSize: T_XS, fontWeight: 700, color: RED, border: `1px solid ${RED}`, borderRadius: R_SM, padding: '0 5px', letterSpacing: '0.04em' }}>at risk</span>
                              )}
                              <div style={{ fontSize: T_XS, color: MUTED }}>{s.studentId ?? s.email}</div>
                            </div>
                          </div>
                        </td>
                        <td><Ticks ticks={s.recentAttendance} /></td>
                        <td className="num">{s.attendancePercent == null ? '—' : `${Math.round(s.attendancePercent)}%`}</td>
                        <td><Squares states={s.recentHomework} /></td>
                        <td className="num">{s.avgTestPercentage == null ? '—' : Math.round(s.avgTestPercentage)}</td>
                        <td><Sparkline values={s.recentMarks} label={s.recentMarks.length ? `Marks: ${s.recentMarks.join(', ')}` : 'No marks yet'} /></td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: MUTED }}>
                          {students.length === 0
                            ? 'No students in this batch.'
                            : onlyRisk && !query.trim() && riskIds.size === 0
                              ? 'No at-risk students found.'
                              : `No student matches${query.trim() ? ` "${query.trim()}"` : ' these filters'}.`}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {view === 'list' && !loading && <Legend />}
          </div>
        )}
      </div>

      {openStudent && (
        <StudentPanel student={openStudent} atRisk={atRiskMap.get(openStudent.id)} onClose={() => setOpenId(null)} />
      )}
    </>
  );
}

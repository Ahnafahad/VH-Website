'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Stethoscope, ArrowUpDown } from 'lucide-react';

// ─── Response contract (mirrors /api/admin/diagnosis-fbs) ───────────────────────

interface AssessmentSummary {
  slug: string;
  title: string;
  totalMarks: number;
  totalTakers: number;
  inProgress: number;
  banned: number;
  avgScore: number | null;
  avgPercentage: number | null;
  highest: number | null;
  lowest: number | null;
  avgTimeSpentSeconds: number | null;
}

interface AttemptRow {
  testSlug: string;
  testTitle: string;
  userId: number;
  userName: string;
  userEmail: string;
  role: string;
  isLead: boolean;
  status: string;
  score: number | null;
  percentage: number | null;
  startedAt: number | null;
  submittedAt: number | null;
  timeSpentSeconds: number | null;
  tabLeaveCount: number;
  resetCount: number;
}

interface DiagnosisResponse {
  assessments: AssessmentSummary[];
  attempts: AttemptRow[];
  totals: { uniqueTakers: number; totalSubmitted: number; totalLeads: number };
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function fmtTime(seconds: number | null): string {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function fmtDate(ms: number | null): string {
  if (ms == null) return '—';
  return new Date(ms).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  submitted:   { bg: 'rgba(16,185,129,0.10)',  color: '#059669', label: 'Submitted' },
  in_progress: { bg: 'rgba(245,158,11,0.12)',  color: '#B45309', label: 'In progress' },
  banned:      { bg: 'rgba(239,68,68,0.10)',   color: '#DC2626', label: 'Banned' },
};

type SortKey = 'name' | 'assessment' | 'score' | 'percentage' | 'status' | 'timeSpent' | 'submitted';

// ─── Summary card ───────────────────────────────────────────────────────────────

function SummaryCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div style={{
      background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12,
      padding: '16px 18px', flex: 1, minWidth: 0,
    }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </p>
      <p style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 700, color: accent ? '#D62B38' : '#0F172A', letterSpacing: '-0.03em', lineHeight: 1 }}>
        {value}
      </p>
    </div>
  );
}

// ─── Assessment breakdown card ──────────────────────────────────────────────────

function AssessmentCard({ a }: { a: AssessmentSummary }) {
  const stat = (label: string, value: string) => (
    <div>
      <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{value}</p>
    </div>
  );

  return (
    <div style={{
      background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12,
      padding: '16px 18px', flex: 1, minWidth: 240,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 14 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.01em' }}>{a.title}</p>
        <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>/{a.totalMarks}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        {stat('Takers', String(a.totalTakers))}
        {stat('Avg score', a.avgScore != null ? String(a.avgScore) : '—')}
        {stat('Avg %', a.avgPercentage != null ? `${Math.round(a.avgPercentage)}%` : '—')}
        {stat('Highest', a.highest != null ? String(a.highest) : '—')}
        {stat('Lowest', a.lowest != null ? String(a.lowest) : '—')}
        {stat('Avg time', fmtTime(a.avgTimeSpentSeconds))}
      </div>

      {(a.inProgress > 0 || a.banned > 0) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid #F3F4F6', flexWrap: 'wrap' }}>
          {a.inProgress > 0 && (
            <span style={{ fontSize: 11, fontWeight: 600, color: '#B45309', background: 'rgba(245,158,11,0.12)', padding: '2px 8px', borderRadius: 100 }}>
              {a.inProgress} in progress
            </span>
          )}
          {a.banned > 0 && (
            <span style={{ fontSize: 11, fontWeight: 600, color: '#DC2626', background: 'rgba(239,68,68,0.10)', padding: '2px 8px', borderRadius: 100 }}>
              {a.banned} banned
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sortable header cell ───────────────────────────────────────────────────────

function Th({
  label, sortKey, activeSort, dir, onSort, align = 'left', sortable = true,
}: {
  label: string;
  sortKey?: SortKey;
  activeSort?: SortKey;
  dir?: 'asc' | 'desc';
  onSort?: (k: SortKey) => void;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
}) {
  const isActive = sortable && sortKey && activeSort === sortKey;
  return (
    <button
      onClick={() => sortable && sortKey && onSort?.(sortKey)}
      disabled={!sortable || !sortKey}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
        width: '100%', background: 'transparent', border: 'none', padding: 0,
        cursor: sortable && sortKey ? 'pointer' : 'default',
        fontSize: 11, fontWeight: 600, color: isActive ? '#D62B38' : '#9CA3AF',
        letterSpacing: '0.06em', textTransform: 'uppercase',
        textAlign: align,
      }}
    >
      {label}
      {sortable && sortKey && (
        <ArrowUpDown size={11} style={{ opacity: isActive ? 1 : 0.4, transform: isActive && dir === 'asc' ? 'rotate(180deg)' : 'none' }} aria-hidden />
      )}
    </button>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

export default function DiagnosisFbsClient() {
  const [data, setData]       = useState<DiagnosisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  const [query, setQuery]           = useState('');
  const [assessment, setAssessment] = useState('all');
  const [leadsOnly, setLeadsOnly]   = useState(false);
  const [sort, setSort]             = useState<SortKey>('submitted');
  const [dir, setDir]               = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/diagnosis-fbs');
        if (!res.ok) throw new Error('Failed');
        const json = (await res.json()) as DiagnosisResponse;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const onSort = (k: SortKey) => {
    if (k === sort) setDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSort(k); setDir(k === 'name' || k === 'assessment' ? 'asc' : 'desc'); }
  };

  const rows = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    let list = data.attempts.filter(a => {
      if (assessment !== 'all' && a.testSlug !== assessment) return false;
      if (leadsOnly && !a.isLead) return false;
      if (q && !a.userName.toLowerCase().includes(q) && !a.userEmail.toLowerCase().includes(q)) return false;
      return true;
    });

    const mul = dir === 'asc' ? 1 : -1;
    const num = (v: number | null) => (v == null ? -Infinity : v);
    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'name':       return mul * a.userName.localeCompare(b.userName);
        case 'assessment': return mul * a.testSlug.localeCompare(b.testSlug);
        case 'score':      return mul * (num(a.score) - num(b.score));
        case 'percentage': return mul * (num(a.percentage) - num(b.percentage));
        case 'status':     return mul * a.status.localeCompare(b.status);
        case 'timeSpent':  return mul * (num(a.timeSpentSeconds) - num(b.timeSpentSeconds));
        case 'submitted':  return mul * (num(a.submittedAt) - num(b.submittedAt));
        default:           return 0;
      }
    });
    return list;
  }, [data, query, assessment, leadsOnly, sort, dir]);

  const GRID = '1.6fr 1.8fr 1fr 70px 60px 100px 90px 130px 90px';

  return (
    <>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <div style={{ maxWidth: 1180, margin: '0 auto' }}>

        {/* Page title */}
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: 'rgba(214,43,56,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Stethoscope size={20} style={{ color: '#D62B38' }} aria-hidden />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.04em', lineHeight: 1.2 }}>
              Diagnosis FBS
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9CA3AF' }}>
              Who took the FBS diagnostics, their scores, and leads to follow up
            </p>
          </div>
        </div>

        {loading && (
          <div style={{ padding: '60px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#9CA3AF', fontSize: 13 }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} aria-hidden />
            Loading…
          </div>
        )}

        {!loading && error && (
          <div style={{ background: '#FAFAFA', border: '1px dashed #E5E7EB', borderRadius: 10, padding: '40px 24px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
            Failed to load diagnostic data.
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* Summary cards */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <SummaryCard label="Unique takers" value={data.totals.uniqueTakers} />
              <SummaryCard label="Total submitted" value={data.totals.totalSubmitted} />
              <SummaryCard label="Total leads" value={data.totals.totalLeads} accent />
            </div>

            {/* Per-assessment breakdown */}
            {data.assessments.length > 0 && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
                {data.assessments.map(a => <AssessmentCard key={a.slug} a={a} />)}
              </div>
            )}

            {/* Filters */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search name or email…"
                aria-label="Search by name or email"
                style={{
                  flex: 1, minWidth: 200, padding: '9px 12px', borderRadius: 8,
                  border: '1.5px solid #E5E7EB', background: '#FFFFFF',
                  fontSize: 13, color: '#0F172A', outline: 'none',
                }}
              />

              <select
                value={assessment}
                onChange={e => setAssessment(e.target.value)}
                aria-label="Filter by assessment"
                style={{
                  padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E5E7EB',
                  background: '#FFFFFF', fontSize: 13, fontWeight: 600, color: '#0F172A', outline: 'none', cursor: 'pointer',
                }}
              >
                <option value="all">All assessments</option>
                {data.assessments.map(a => (
                  <option key={a.slug} value={a.slug}>{a.title}</option>
                ))}
              </select>

              <motion.button
                onClick={() => setLeadsOnly(v => !v)}
                whileTap={{ scale: 0.96 }}
                aria-pressed={leadsOnly}
                style={{
                  padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: leadsOnly ? '1.5px solid #D62B38' : '1.5px solid #E5E7EB',
                  background: leadsOnly ? 'rgba(214,43,56,0.05)' : '#FFFFFF',
                  color: leadsOnly ? '#D62B38' : '#374151',
                }}
              >
                Leads only
              </motion.button>
            </div>

            {/* Attempts table (desktop) */}
            <style>{`
              #diag-table { display: block; }
              #diag-cards { display: none; }
              @media (max-width: 860px) {
                #diag-table { display: none !important; }
                #diag-cards { display: flex !important; }
              }
            `}</style>

            <div id="diag-table" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: GRID, padding: '10px 16px', background: '#FAFAFA', borderBottom: '1px solid #F3F4F6', gap: 8, alignItems: 'center' }}>
                <Th label="Name"       sortKey="name"       activeSort={sort} dir={dir} onSort={onSort} />
                <Th label="Email"      sortable={false} />
                <Th label="Assessment" sortKey="assessment" activeSort={sort} dir={dir} onSort={onSort} />
                <Th label="Score"      sortKey="score"      activeSort={sort} dir={dir} onSort={onSort} align="right" />
                <Th label="%"          sortKey="percentage" activeSort={sort} dir={dir} onSort={onSort} align="right" />
                <Th label="Status"     sortKey="status"     activeSort={sort} dir={dir} onSort={onSort} />
                <Th label="Time"       sortKey="timeSpent"  activeSort={sort} dir={dir} onSort={onSort} align="right" />
                <Th label="Submitted"  sortKey="submitted"  activeSort={sort} dir={dir} onSort={onSort} />
                <Th label="Flags"      sortable={false} align="right" />
              </div>

              {rows.length === 0 && (
                <div style={{ padding: '40px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                  No attempts match your filters.
                </div>
              )}

              {rows.map((a, i) => {
                const st = STATUS_STYLES[a.status] ?? { bg: '#F3F4F6', color: '#6B7280', label: a.status };
                return (
                  <div
                    key={`${a.userId}-${a.testSlug}`}
                    style={{
                      display: 'grid', gridTemplateColumns: GRID, gap: 8, alignItems: 'center',
                      padding: '11px 16px',
                      borderBottom: i < rows.length - 1 ? '1px solid #F9FAFB' : 'none',
                    }}
                  >
                    {/* Name + lead badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.userName}
                      </span>
                      {a.isLead && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#D62B38', background: 'rgba(214,43,56,0.08)', padding: '1px 6px', borderRadius: 100, letterSpacing: '0.04em', flexShrink: 0 }}>
                          LEAD
                        </span>
                      )}
                    </div>

                    {/* Email (selectable) */}
                    <span style={{ fontSize: 12, color: '#6B7280', userSelect: 'all', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.userEmail}
                    </span>

                    {/* Assessment */}
                    <span style={{ fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.testTitle}
                    </span>

                    {/* Score */}
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', textAlign: 'right' }}>
                      {a.score != null ? a.score : '—'}
                    </span>

                    {/* Percentage */}
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#D62B38', textAlign: 'right' }}>
                      {a.percentage != null ? `${Math.round(a.percentage)}%` : '—'}
                    </span>

                    {/* Status */}
                    <span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: st.color, background: st.bg, padding: '2px 8px', borderRadius: 100, whiteSpace: 'nowrap' }}>
                        {st.label}
                      </span>
                    </span>

                    {/* Time */}
                    <span style={{ fontSize: 12, color: '#374151', textAlign: 'right' }}>
                      {fmtTime(a.timeSpentSeconds)}
                    </span>

                    {/* Submitted */}
                    <span style={{ fontSize: 11, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {fmtDate(a.submittedAt)}
                    </span>

                    {/* Flags */}
                    <span style={{ fontSize: 11, color: (a.tabLeaveCount > 0 || a.resetCount > 0) ? '#DC2626' : '#D1D5DB', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {a.tabLeaveCount > 0 || a.resetCount > 0
                        ? `${a.tabLeaveCount}/${a.resetCount}`
                        : '—'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Attempts cards (mobile) */}
            <div id="diag-cards" style={{ flexDirection: 'column', gap: 10 }}>
              {rows.length === 0 && (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 13, background: '#FAFAFA', border: '1px dashed #E5E7EB', borderRadius: 10 }}>
                  No attempts match your filters.
                </div>
              )}
              {rows.map(a => {
                const st = STATUS_STYLES[a.status] ?? { bg: '#F3F4F6', color: '#6B7280', label: a.status };
                return (
                  <div key={`${a.userId}-${a.testSlug}`} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{a.userName}</span>
                      {a.isLead && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#D62B38', background: 'rgba(214,43,56,0.08)', padding: '1px 6px', borderRadius: 100, letterSpacing: '0.04em' }}>
                          LEAD
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '0 0 10px', fontSize: 12, color: '#6B7280', userSelect: 'all', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.userEmail}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: '#374151' }}>{a.testTitle}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: st.color, background: st.bg, padding: '2px 8px', borderRadius: 100, flexShrink: 0 }}>
                        {st.label}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, paddingTop: 10, borderTop: '1px solid #F3F4F6' }}>
                      <div>
                        <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Score</p>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                          {a.score != null ? a.score : '—'}
                          {a.percentage != null && <span style={{ fontSize: 11, fontWeight: 600, color: '#D62B38', marginLeft: 4 }}>{Math.round(a.percentage)}%</span>}
                        </span>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time</p>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{fmtTime(a.timeSpentSeconds)}</span>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Flags</p>
                        <span style={{ fontSize: 13, fontWeight: 600, color: (a.tabLeaveCount > 0 || a.resetCount > 0) ? '#DC2626' : '#D1D5DB' }}>
                          {a.tabLeaveCount > 0 || a.resetCount > 0 ? `${a.tabLeaveCount}/${a.resetCount}` : '—'}
                        </span>
                      </div>
                    </div>

                    <p style={{ margin: '10px 0 0', fontSize: 11, color: '#9CA3AF' }}>{fmtDate(a.submittedAt)}</p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  BG, BORDER, FieldSelect, MUTED, PageHeader, R_LG, R_PILL, RED, SLATE, SPIN_CSS, SURFACE, SURFACE_ALT, T_BASE, T_SM, T_XS,
} from '@/components/admin/lms/lms-shared';
import { ScoreHistogram } from '@/components/essays/EssayCharts';
import type { EssayStats } from '@/lib/essays/types';

interface SeriesA {
  id: number;
  title: string;
  essayDate: string | null;
  deadline: string;
  status: string;
  publishedAt: string | null;
  product: string;
  batch: string | null;
  max: number;
  audienceSize: number;
  counts: { submitted: number; graded: number; rejected: number };
  stats: EssayStats;
  sectionAverages: { name: string; max: number; average: number | null }[];
  nonSubmitters: { id: number; name: string; email: string }[];
  graders: { id: number; name: string; count: number; averagePct: number }[] | null;
}

interface Data {
  series: SeriesA[];
  students: { id: number; name: string; email: string; scores: Record<number, number> }[];
  canSeeGraders: boolean;
}

export default function EssayAnalyticsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seriesId, setSeriesId] = useState<number | null>(null);
  const [studentQuery, setStudentQuery] = useState('');
  const [studentId, setStudentId] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/admin/essays/analytics').then(async r => {
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.error ?? 'Could not load analytics'); return; }
      setData(j);
      const latest = [...(j.series as SeriesA[])].reverse().find(s => s.status === 'active');
      setSeriesId(latest?.id ?? j.series[0]?.id ?? null);
    }).catch(() => setError('Network error'));
  }, []);

  const s = data?.series.find(x => x.id === seriesId) ?? null;
  const active = useMemo(() => (data?.series ?? []).filter(x => x.status === 'active'), [data]);
  const trend = active.map(x => ({
    label: x.title.replace(/^Essay Series\s*/i, 'S'),
    avg: x.stats.average === null ? null : Math.round((x.stats.average / x.max) * 1000) / 10,
    high: x.stats.highest === null ? null : Math.round((x.stats.highest / x.max) * 1000) / 10,
    submitted: x.audienceSize ? Math.round(((x.counts.submitted + x.counts.graded + x.counts.rejected) / x.audienceSize) * 1000) / 10 : null,
  }));
  const students = (data?.students ?? []).filter(st => !studentQuery || st.name.toLowerCase().includes(studentQuery.toLowerCase()));
  const student = data?.students.find(st => st.id === studentId) ?? null;

  const tile = { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_LG, padding: 14 } as const;
  const h2 = { margin: '0 0 10px', fontSize: 16, fontWeight: 700, color: SLATE } as const;

  if (error) return <p style={{ color: RED, fontSize: T_SM }}>{error}</p>;
  if (!data) return <p style={{ color: MUTED, fontSize: T_SM }}>Loading…</p>;

  return (
    <div style={{ maxWidth: 1180 }}>
      <style>{SPIN_CSS}</style>
      <Link href="/admin/essays" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: T_SM, color: MUTED, textDecoration: 'none', marginBottom: 12 }}>
        <ArrowLeft size={14} aria-hidden /> Essays
      </Link>
      <PageHeader title="Essay analytics" subtitle="How each series went, how students are trending, and how consistently scripts are being marked." />

      {data.series.length === 0 ? (
        <p style={{ fontSize: T_SM, color: MUTED }}>No essay series yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={tile}>
            <h2 style={h2}>Across series</h2>
            <p style={{ margin: '0 0 8px', fontSize: T_XS, color: MUTED }}>Class average and highest score (% of the series total), and the share of the audience who submitted.</p>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trend} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                <CartesianGrid vertical={false} stroke={BORDER} />
                <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fill: MUTED, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip formatter={v => (v === null || v === undefined ? '—' : `${v}%`)} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${BORDER}` }} />
                <Line type="monotone" dataKey="avg" name="Class average" stroke={RED} strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
                <Line type="monotone" dataKey="high" name="Highest" stroke={SLATE} strokeWidth={1.5} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls />
                <Line type="monotone" dataKey="submitted" name="Submitted" stroke={MUTED} strokeWidth={1.5} dot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={tile}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
              <h2 style={{ ...h2, margin: 0 }}>Series detail</h2>
              <div style={{ width: 280 }}>
                <FieldSelect aria-label="Series" value={seriesId ?? ''} onChange={e => setSeriesId(Number(e.target.value))}>
                  {data.series.map(x => <option key={x.id} value={x.id}>{x.title}{x.status === 'archived' ? ' (archived)' : ''}</option>)}
                </FieldSelect>
              </div>
            </div>
            {s && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 12 }}>
                  {[
                    ['Audience', s.audienceSize],
                    ['Submitted', s.counts.submitted + s.counts.graded + s.counts.rejected],
                    ['Graded', s.counts.graded],
                    ['Rejected', s.counts.rejected],
                    ['Average', s.stats.average === null ? '—' : `${s.stats.average} / ${s.max}`],
                    ['High · Low', s.stats.highest === null ? '—' : `${s.stats.highest} · ${s.stats.lowest}`],
                  ].map(([k, v]) => (
                    <div key={k as string} style={{ background: BG, borderRadius: R_LG, padding: 10 }}>
                      <div style={{ fontSize: T_XS, color: MUTED }}>{k}</div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: SLATE }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: T_SM, fontWeight: 700, color: SLATE }}>Distribution of series totals</p>
                    <ScoreHistogram bins={s.stats.histogram} tone="light" height={200} />
                  </div>
                  <div>
                    <p style={{ margin: '0 0 8px', fontSize: T_SM, fontWeight: 700, color: SLATE }}>Section averages</p>
                    {s.sectionAverages.map(sa => (
                      <div key={sa.name} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: T_SM, color: SLATE }}><span>{sa.name}</span><span>{sa.average ?? '—'} / {sa.max}</span></div>
                        <div style={{ height: 6, borderRadius: R_PILL, background: BG, marginTop: 4 }}>
                          <div style={{ width: `${sa.average === null ? 0 : (sa.average / sa.max) * 100}%`, height: '100%', borderRadius: R_PILL, background: RED }} />
                        </div>
                      </div>
                    ))}
                    {s.graders && s.graders.length > 0 && (
                      <>
                        <p style={{ margin: '16px 0 8px', fontSize: T_SM, fontWeight: 700, color: SLATE }}>By grader (admins only)</p>
                        {s.graders.map(g => (
                          <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: T_SM, color: SLATE, padding: '4px 0', borderTop: `1px solid ${BORDER}` }}>
                            <span>{g.name} <span style={{ color: MUTED }}>· {g.count} script{g.count === 1 ? '' : 's'}</span></span>
                            <span style={{ fontWeight: 700 }}>avg {g.averagePct}%</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
                {s.nonSubmitters.length > 0 && (
                  <details style={{ marginTop: 12 }}>
                    <summary style={{ cursor: 'pointer', fontSize: T_SM, fontWeight: 700, color: SLATE }}>Didn&apos;t submit ({s.nonSubmitters.length})</summary>
                    <p style={{ margin: '8px 0 0', fontSize: T_SM, color: SLATE, lineHeight: 1.7 }}>{s.nonSubmitters.map(n => n.name).join(', ')}</p>
                  </details>
                )}
              </>
            )}
          </div>

          <div style={tile}>
            <h2 style={h2}>Students</h2>
            <input
              aria-label="Search students"
              placeholder="Search students"
              value={studentQuery}
              onChange={e => setStudentQuery(e.target.value)}
              style={{ width: 260, maxWidth: '100%', border: `1px solid ${BORDER}`, borderRadius: R_LG, padding: '8px 10px', fontSize: T_BASE, marginBottom: 10 }}
            />
            {student && (
              <div style={{ background: BG, borderRadius: R_LG, padding: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: T_SM, fontWeight: 700, color: SLATE }}>
                  <span>{student.name}</span>
                  <button type="button" onClick={() => setStudentId(null)} style={{ border: 'none', background: 'transparent', color: MUTED, cursor: 'pointer', fontSize: T_XS }}>Close</button>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={active.map(x => ({ label: x.title.replace(/^Essay Series\s*/i, 'S'), pct: student.scores[x.id] ?? null, avg: x.stats.average === null ? null : Math.round((x.stats.average / x.max) * 1000) / 10 }))} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                    <CartesianGrid vertical={false} stroke={BORDER} />
                    <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} unit="%" tick={{ fill: MUTED, fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip formatter={v => (v === null || v === undefined ? '—' : `${v}%`)} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${BORDER}` }} />
                    <Line type="monotone" dataKey="pct" name={student.name} stroke={RED} strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
                    <Line type="monotone" dataKey="avg" name="Class average" stroke={MUTED} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: T_SM }}>
                <thead style={{ background: SURFACE_ALT }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '6px 8px', color: MUTED, fontSize: T_XS }}>Student</th>
                    {active.map(x => <th key={x.id} style={{ textAlign: 'right', padding: '6px 8px', color: MUTED, fontSize: T_XS, whiteSpace: 'nowrap' }}>{x.title.replace(/^Essay Series\s*/i, 'S')}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {students.map(st => (
                    <tr key={st.id} onClick={() => setStudentId(st.id)} style={{ cursor: 'pointer', background: st.id === studentId ? `${RED}0A` : undefined }}>
                      <td style={{ padding: '6px 8px', borderTop: `1px solid ${BORDER}`, color: SLATE }}>{st.name}</td>
                      {active.map(x => (
                        <td key={x.id} style={{ padding: '6px 8px', borderTop: `1px solid ${BORDER}`, textAlign: 'right', color: st.scores[x.id] === undefined ? MUTED : SLATE }}>
                          {st.scores[x.id] === undefined ? '—' : `${st.scores[x.id]}%`}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

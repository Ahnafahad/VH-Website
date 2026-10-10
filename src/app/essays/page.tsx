'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SectionTrendChart, TrendChart } from '@/components/essays/EssayCharts';
import type { EssaySeriesStudentEntry, EssaySlotStatus } from '@/lib/essays/types';

interface OverviewSeries {
  id: number;
  title: string;
  max: number;
  myTotal: number | null;
  myPct: number | null;
  classAvgPct: number | null;
  highestPct: number | null;
  sectionPct: Record<string, number>;
}

type PageState =
  | { kind: 'loading' }
  | { kind: 'ready'; series: EssaySeriesStudentEntry[]; overview: OverviewSeries[] }
  | { kind: 'error'; message: string };

const STATUS: Record<EssaySlotStatus, { label: string; cls: string }> = {
  open: { label: 'Open', cls: 'text-exam-gold border-exam-gold/40 bg-exam-gold/10' },
  submitted: { label: 'Submitted', cls: 'text-exam-ink-muted border-exam-border bg-exam-elevated' },
  rejected: { label: 'Resubmit', cls: 'text-exam-danger border-exam-danger/40 bg-exam-danger/10' },
  graded: { label: 'Graded', cls: 'text-exam-success border-exam-success/40 bg-exam-success/10' },
  missed: { label: 'Missed', cls: 'text-exam-ink-faint border-exam-border bg-transparent' },
  closed: { label: 'Closed', cls: 'text-exam-ink-faint border-exam-border bg-transparent' },
};

function timeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'closed';
  const h = Math.floor(ms / 3_600_000);
  if (h >= 48) return `${Math.floor(h / 24)} days left`;
  if (h >= 1) return `${h}h ${Math.floor((ms % 3_600_000) / 60_000)}m left`;
  return `${Math.max(1, Math.floor(ms / 60_000))} min left`;
}

export default function EssaysHubPage() {
  const [state, setState] = useState<PageState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetch('/api/essays'), fetch('/api/essays/overview')])
      .then(async ([a, b]) => {
        const ja = await a.json().catch(() => ({}));
        const jb = await b.json().catch(() => ({}));
        if (cancelled) return;
        if (!a.ok) { setState({ kind: 'error', message: ja.error ?? 'Could not load essays.' }); return; }
        setState({ kind: 'ready', series: ja.series, overview: b.ok ? jb.series : [] });
      })
      .catch(() => { if (!cancelled) setState({ kind: 'error', message: 'Network error — check your connection.' }); });
    return () => { cancelled = true; };
  }, []);

  const overview = state.kind === 'ready' ? state.overview : [];
  const sectionNames = [...new Set(overview.flatMap(o => Object.keys(o.sectionPct)))];

  return (
    <main className="min-h-screen bg-exam-base text-exam-ink">
      <div className="border-b border-exam-border bg-exam-surface">
        <div className="max-w-4xl mx-auto px-4 pb-10 sm:pb-14" style={{ paddingTop: 'max(6rem, calc(6rem + env(safe-area-inset-top)))' }}>
          <p className="text-exam-gold text-xs font-bold uppercase tracking-widest mb-3">Essays</p>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-exam-ink mb-2">Essay Series</h1>
          <p className="text-exam-ink-muted text-base max-w-lg">
            Photograph your handwritten essay after you finish it at the centre and submit it here. Your marked script — with your teacher&apos;s pen markings and comments — comes back to this page.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10 sm:py-14 space-y-12">
        {state.kind === 'loading' && <p className="text-exam-ink-muted">Loading…</p>}
        {state.kind === 'error' && <p className="text-exam-danger">{state.message}</p>}

        {state.kind === 'ready' && (
          <section>
            {state.series.length === 0 ? (
              <p className="text-exam-ink-muted">No essay series yet. They appear here when your teachers set one.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {state.series.map(s => {
                  const open = new Date(s.deadline).getTime() > Date.now();
                  return (
                    <Link key={s.id} href={`/essays/${s.id}`} className="rounded-xl border border-exam-border bg-exam-elevated p-4 hover:border-exam-gold/50 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-exam-ink">{s.title}</p>
                          <p className="text-xs text-exam-ink-faint mt-0.5">
                            {s.essayDate ? new Date(`${s.essayDate}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' : ''}
                            {open ? timeLeft(s.deadline) : 'Submissions closed'}
                          </p>
                        </div>
                        {s.seriesTotal !== null && (
                          <span className="font-mono text-sm font-bold text-exam-gold whitespace-nowrap">{s.seriesTotal}/{s.seriesMax}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {s.slots.map(slot => (
                          <span key={slot.essayIndex} className={`rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${STATUS[slot.status].cls}`}>
                            {s.essayCount > 1 ? `Essay ${slot.essayIndex}: ` : ''}{STATUS[slot.status].label}
                          </span>
                        ))}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {overview.length > 0 && (
          <section className="space-y-8">
            <div>
              <h2 className="font-serif text-xl font-semibold mb-1">Your progress</h2>
              <p className="text-sm text-exam-ink-muted mb-4">Your score in each series as a percentage, next to the class average.</p>
              <div className="rounded-xl border border-exam-border bg-exam-surface p-4">
                <TrendChart points={overview.map(o => ({ label: o.title.replace(/^Essay Series\s*/i, 'S'), mine: o.myPct, classAvg: o.classAvgPct }))} />
              </div>
            </div>
            {sectionNames.length > 0 && (
              <div>
                <h3 className="font-serif text-lg font-semibold mb-1">By section</h3>
                <p className="text-sm text-exam-ink-muted mb-4">How each marking section is going for you over time.</p>
                <div className="rounded-xl border border-exam-border bg-exam-surface p-4">
                  <SectionTrendChart
                    sectionNames={sectionNames}
                    rows={overview.map(o => ({ label: o.title.replace(/^Essay Series\s*/i, 'S'), ...Object.fromEntries(sectionNames.map(n => [n, o.sectionPct[n] ?? null])) }))}
                  />
                </div>
              </div>
            )}
            <div className="overflow-x-auto rounded-xl border border-exam-border">
              <table className="w-full text-sm">
                <thead className="bg-exam-surface text-exam-ink-muted">
                  <tr>
                    <th className="text-left font-semibold px-4 py-2">Series</th>
                    <th className="text-right font-semibold px-4 py-2">You</th>
                    <th className="text-right font-semibold px-4 py-2">Class avg</th>
                    <th className="text-right font-semibold px-4 py-2">Highest</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.map(o => (
                    <tr key={o.id} className="border-t border-exam-border">
                      <td className="px-4 py-2"><Link href={`/essays/${o.id}`} className="text-exam-ink hover:text-exam-gold">{o.title}</Link></td>
                      <td className="px-4 py-2 text-right font-mono">{o.myTotal === null ? '—' : `${o.myTotal}/${o.max}`}</td>
                      <td className="px-4 py-2 text-right font-mono text-exam-ink-muted">{o.classAvgPct === null ? '—' : `${o.classAvgPct}%`}</td>
                      <td className="px-4 py-2 text-right font-mono text-exam-ink-muted">{o.highestPct === null ? '—' : `${o.highestPct}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

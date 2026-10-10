'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Download, Loader2 } from 'lucide-react';
import EssayUploader from '@/components/essays/EssayUploader';
import MarkedScriptViewer from '@/components/essays/MarkedScriptViewer';
import { ScoreHistogram } from '@/components/essays/EssayCharts';
import { buildMarkedPdf, downloadBlob } from '@/lib/essays/render-client';
import type { EssayHistogramBin, EssayPageDTO, EssaySection, EssaySlotStatus } from '@/lib/essays/types';

interface EssayEntry {
  essayIndex: number;
  status: EssaySlotStatus;
  submittedAt: string | null;
  attempt: number;
  rejectReason: string | null;
  pages: EssayPageDTO[];
  result: null | {
    marks: Record<string, number | null>;
    sectionComments: Record<string, string>;
    total: number | null;
    overallFeedback: string;
    gradedBy: string | null;
    gradedAt: string | null;
  };
}

interface Detail {
  series: {
    id: number;
    title: string;
    prompt: string;
    essayDate: string | null;
    essayCount: number;
    sections: EssaySection[];
    totalMarks: number;
    deadline: string;
    published: boolean;
    deadlinePassed: boolean;
  };
  essays: EssayEntry[];
  stats: null | { myTotal: number; max: number; classAverage: number | null; highest: number | null; count: number; histogram: EssayHistogramBin[] };
}

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka' }).format(new Date(iso));

export default function EssaySeriesPage({ params }: { params: Promise<{ seriesId: string }> }) {
  const { seriesId } = use(params);
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/essays/${seriesId}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setError(body.error ?? 'Could not load this series.'); return; }
    setData(body);
  }, [seriesId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <main className="min-h-screen bg-exam-base text-exam-ink">
      <div className="border-b border-exam-border bg-exam-surface">
        <div className="max-w-4xl mx-auto px-4 pb-8 sm:pb-12" style={{ paddingTop: 'max(6rem, calc(6rem + env(safe-area-inset-top)))' }}>
          <Link href="/essays" className="text-exam-gold text-xs font-bold uppercase tracking-widest">← Essays</Link>
          {data && (
            <>
              <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-exam-ink mt-3 mb-2">{data.series.title}</h1>
              <p className="text-sm text-exam-ink-muted">
                {data.series.essayDate && <>Written {new Date(`${data.series.essayDate}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · </>}
                {data.series.deadlinePassed ? 'Submissions closed ' : 'Submit by '}{fmtDate(data.series.deadline)}
              </p>
              {data.series.prompt && (
                <blockquote className="mt-5 border-l-2 border-exam-gold pl-4 text-exam-ink whitespace-pre-wrap">{data.series.prompt}</blockquote>
              )}
            </>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10 space-y-10">
        {error && <p className="text-exam-danger">{error}</p>}
        {!data && !error && <p className="text-exam-ink-muted">Loading…</p>}

        {data?.stats && <StatsCard stats={data.stats} />}

        {data?.essays.map(e => (
          <EssayBlock
            key={e.essayIndex}
            detail={data}
            essay={e}
            justSubmitted={justSubmitted === e.essayIndex}
            onSubmitted={() => { setJustSubmitted(e.essayIndex); void load(); }}
          />
        ))}
      </div>
    </main>
  );
}

function StatsCard({ stats }: { stats: NonNullable<Detail['stats']> }) {
  const tile = 'rounded-xl border border-exam-border bg-exam-elevated p-4';
  return (
    <section className="rounded-2xl border border-exam-border bg-exam-surface p-5">
      <div className="grid grid-cols-3 gap-3">
        <div className={tile}>
          <p className="text-xs uppercase tracking-wide text-exam-ink-faint">Your score</p>
          <p className="font-mono text-2xl font-bold text-exam-gold mt-1">{stats.myTotal}<span className="text-sm text-exam-ink-muted">/{stats.max}</span></p>
        </div>
        <div className={tile}>
          <p className="text-xs uppercase tracking-wide text-exam-ink-faint">Class average</p>
          <p className="font-mono text-2xl font-bold mt-1">{stats.classAverage ?? '—'}</p>
        </div>
        <div className={tile}>
          <p className="text-xs uppercase tracking-wide text-exam-ink-faint">Highest</p>
          <p className="font-mono text-2xl font-bold mt-1">{stats.highest ?? '—'}</p>
        </div>
      </div>
      <p className="text-sm text-exam-ink-muted mt-5 mb-2">How the class scored ({stats.count} student{stats.count === 1 ? '' : 's'}) — your bar is highlighted.</p>
      <ScoreHistogram bins={stats.histogram} highlight={stats.myTotal} />
    </section>
  );
}

function EssayBlock({ detail, essay, justSubmitted, onSubmitted }: { detail: Detail; essay: EssayEntry; justSubmitted: boolean; onSubmitted: () => void }) {
  const s = detail.series;
  const label = s.essayCount > 1 ? `Essay ${essay.essayIndex}` : 'your essay';
  const heading = s.essayCount > 1 ? `Essay ${essay.essayIndex}` : 'Your essay';
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);

  const downloadPdf = async () => {
    if (!essay.result) return;
    setPdfBusy('Preparing…');
    try {
      const blob = await buildMarkedPdf([{
        title: s.essayCount > 1 ? `${s.title} — Essay ${essay.essayIndex}` : s.title,
        studentName: '',
        sections: s.sections,
        marks: essay.result.marks,
        sectionComments: essay.result.sectionComments,
        total: essay.result.total,
        totalMarks: s.totalMarks,
        overallFeedback: essay.result.overallFeedback,
        gradedBy: essay.result.gradedBy,
        pages: essay.pages,
      }], (d, t) => setPdfBusy(`Page ${d} of ${t}…`));
      downloadBlob(blob, `${s.title}${s.essayCount > 1 ? `-essay-${essay.essayIndex}` : ''}-marked.pdf`.replace(/\s+/g, '-'));
    } finally {
      setPdfBusy(null);
    }
  };

  return (
    <section>
      <h2 className="font-serif text-2xl font-semibold mb-4">{heading}</h2>

      {justSubmitted && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-exam-success/40 bg-exam-success/10 p-4">
          <CheckCircle2 className="w-5 h-5 text-exam-success flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-exam-ink">Submitted</p>
            <p className="text-exam-ink-muted">Received {essay.submittedAt ? fmtDate(essay.submittedAt) : 'just now'} · {essay.pages.length} page{essay.pages.length === 1 ? '' : 's'}. You&apos;ll be notified when your marks are out.</p>
          </div>
        </div>
      )}

      {essay.status === 'open' && (
        <EssayUploader seriesId={s.id} essayIndex={essay.essayIndex} essayLabel={label} resubmission={false} onSubmitted={onSubmitted} />
      )}

      {essay.status === 'rejected' && (
        <>
          <div className="mb-5 rounded-xl border border-exam-danger/40 bg-exam-danger/10 p-4 text-sm">
            <p className="font-semibold text-exam-ink mb-1">Your teacher sent this back — please resubmit.</p>
            <p className="text-exam-ink-muted whitespace-pre-wrap">Reason: {essay.rejectReason}</p>
          </div>
          <EssayUploader seriesId={s.id} essayIndex={essay.essayIndex} essayLabel={label} resubmission onSubmitted={onSubmitted} />
        </>
      )}

      {essay.status === 'submitted' && !justSubmitted && (
        <div className="rounded-xl border border-exam-border bg-exam-elevated p-4 text-sm">
          <p className="font-semibold text-exam-ink">Submitted — waiting for marking</p>
          <p className="text-exam-ink-muted">
            Received {essay.submittedAt ? fmtDate(essay.submittedAt) : ''} · {essay.pages.length} page{essay.pages.length === 1 ? '' : 's'}. Results are released once every script in this series has been checked.
          </p>
        </div>
      )}

      {essay.status === 'missed' && (
        <p className="rounded-xl border border-exam-border p-4 text-sm text-exam-ink-muted">Not submitted.</p>
      )}

      {essay.status === 'graded' && essay.result && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-exam-border bg-exam-surface p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="font-mono text-3xl font-bold text-exam-gold">{essay.result.total}<span className="text-base text-exam-ink-muted">/{s.totalMarks}</span></p>
              <p className="text-xs text-exam-ink-faint">{essay.result.gradedBy ? `Marked by ${essay.result.gradedBy}` : ''}</p>
            </div>
            <div className="mt-4 divide-y divide-exam-border">
              {s.sections.map(sec => (
                <div key={sec.key} className="py-2.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-exam-ink">{sec.name}</span>
                    <span className="font-mono text-exam-ink">{essay.result!.marks[sec.key] ?? '—'}<span className="text-exam-ink-faint">/{sec.max}</span></span>
                  </div>
                  {essay.result!.sectionComments[sec.key] && <p className="text-sm text-exam-ink-muted mt-1 whitespace-pre-wrap">{essay.result!.sectionComments[sec.key]}</p>}
                </div>
              ))}
            </div>
            {essay.result.overallFeedback && (
              <div className="mt-4 rounded-xl bg-exam-elevated p-4">
                <p className="text-xs uppercase tracking-wide text-exam-ink-faint mb-1">Feedback</p>
                <p className="text-sm text-exam-ink whitespace-pre-wrap">{essay.result.overallFeedback}</p>
              </div>
            )}
            <button
              onClick={downloadPdf}
              disabled={!!pdfBusy}
              className="mt-5 inline-flex items-center gap-2 rounded-lg border border-exam-border bg-exam-elevated px-4 py-2.5 text-sm font-semibold text-exam-ink hover:border-exam-gold/60 disabled:opacity-60"
            >
              {pdfBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {pdfBusy ?? 'Download marked script (PDF)'}
            </button>
          </div>
          <MarkedScriptViewer pages={essay.pages} />
        </div>
      )}
    </section>
  );
}

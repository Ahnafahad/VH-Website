'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { MockMcqSummary, MockResult, SectionMissed } from '@/lib/mocks/types';

type OfficialResult = Extract<MockResult, { phase: 'official' }>;

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ''));

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-exam-base text-exam-ink">
      <div className="max-w-3xl mx-auto px-4 pb-16" style={{ paddingTop: 'max(6rem, calc(6rem + env(safe-area-inset-top)))' }}>
        <Link href="/mocks" className="text-exam-ink-faint text-xs hover:text-exam-ink transition-colors">← All mocks</Link>
        <h1 className="font-serif text-3xl font-semibold mt-3 mb-8">{title}</h1>
        {children}
      </div>
    </main>
  );
}

const card = 'rounded-2xl border border-exam-border bg-exam-surface p-5 sm:p-6';
const h2 = 'text-exam-gold text-xs font-bold uppercase tracking-widest mb-4';

function Sections({ mcq, missed }: { mcq: MockMcqSummary; missed: SectionMissed[] | null }) {
  return (
    <section className={card}>
      <h2 className={h2}>Part 1 · by section</h2>
      <div className="space-y-6">
        {mcq.sections.map(s => {
          const m = missed?.find(x => x.title === s.title);
          return (
            <div key={s.title}>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-serif text-lg">{s.title}</h3>
                <span className="font-mono text-sm tabular-nums">{num(s.score)} / {num(s.maxScore)}</span>
              </div>
              <p className="text-exam-ink-muted text-sm mt-1">
                {s.correct} right · {s.wrong} wrong · {s.unattempted} skipped
                {m && m.penaltyLost > 0 ? ` · ${num(m.penaltyLost)} marks lost to wrong answers` : ''}
              </p>
              {m && (
                <div className="mt-3 rounded-xl bg-exam-elevated border border-exam-border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-exam-ink-muted mb-2">Biggest missed chances</p>
                  {m.chances.length === 0 ? (
                    <p className="text-sm text-exam-ink-muted">No question that most of your batch got right was missed here.</p>
                  ) : (
                    <ul className="space-y-1.5 text-sm">
                      {m.chances.map(c => (
                        <li key={c.questionId} className="flex flex-wrap gap-x-2">
                          <span className="font-mono text-exam-ink">Q{c.number}</span>
                          <span className="text-exam-ink-muted">
                            {c.cohortCorrectPct}% of your batch got it · you {c.mine === 'skipped' ? 'skipped it' : `chose ${c.yourAnswer}`} · answer {c.correctAnswer}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const onlineTag = <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-exam-ink-faint border border-exam-border rounded px-1.5 py-0.5">Online</span>;

function Official({ r, slug }: { r: OfficialResult; slug: string }) {
  const [sheetError, setSheetError] = useState('');
  const viewSheet = async () => {
    setSheetError('');
    const res = await fetch(`/api/mocks/${slug}/omr-sheet`).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (body?.url) window.open(body.url, '_blank', 'noopener,noreferrer');
    else setSheetError(body?.error ?? 'Could not load your OMR sheet.');
  };
  return (
    <>
      <section className={card}>
        <p className={h2}>Your result</p>
        {r.combined != null ? (
          <p className="font-serif text-5xl font-semibold tabular-nums">
            {num(r.combined)}<span className="text-exam-ink-faint text-2xl"> / {num(r.maxTotal)}</span>
          </p>
        ) : (
          <p className="text-exam-ink-muted">No answer sheet was recorded for you in this mock.</p>
        )}
        {r.omrStatus === 'rejected' && (
          <p className="text-exam-warning text-sm mt-2">Your paper was rejected, so you are not ranked.</p>
        )}
        {r.me && (
          <p className="text-exam-ink-muted text-sm mt-2">
            Rank {r.me.rank} of {r.me.outOf} · ahead of {num(r.me.percentile)}% of your batch
            {r.me.online && onlineTag}
          </p>
        )}
        {r.mcq && (
          <p className="text-exam-ink-muted text-sm mt-1">
            MCQs {num(r.mcq.score)} / {num(r.mcq.maxScore)}
            {r.essayTotal != null ? ` · Essays ${num(r.essayTotal)} / ${num(r.essayMax)}` : ''}
          </p>
        )}
      </section>

      {r.mcq && <Sections mcq={r.mcq} missed={r.missed} />}

      {r.essays && (
        <section className={card}>
          <h2 className={h2}>Part 2 · essays</h2>
          <ul className="space-y-2 text-sm">
            {r.essays.map(e => (
              <li key={e.index} className="flex justify-between gap-3">
                <span>Essay {e.index}</span>
                <span className="font-mono tabular-nums text-exam-ink-muted">
                  {e.status === 'graded' && e.total != null ? `${num(e.total)} / ${num(e.max)}`
                    : e.status === 'not_submitted' ? 'not submitted'
                    : e.status === 'rejected' ? 'needs re-upload' : 'awaiting marks'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r.leaderboard.length > 0 && (
        <section className={card}>
          <h2 className={h2}>Leaderboard</h2>
          <ol className="space-y-2 text-sm">
            {r.leaderboard.map(row => (
              <li key={`${row.rank}-${row.name}`} className="flex items-baseline gap-3">
                <span className="w-6 font-mono text-exam-ink-faint tabular-nums">{row.rank}</span>
                <span className="flex-1">{row.name}{row.online && onlineTag}</span>
                <span className="font-mono tabular-nums">{num(row.total)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        {r.mcq && (
          <Link href={r.reviewHref} className="inline-flex items-center px-5 py-2.5 rounded-xl bg-exam-elevated border border-exam-border text-exam-ink-muted hover:text-exam-ink text-sm transition-colors">
            Question-by-question review →
          </Link>
        )}
        {r.hasOmrImage && (
          <button type="button" onClick={viewSheet} className="inline-flex items-center px-5 py-2.5 rounded-xl bg-exam-elevated border border-exam-border text-exam-ink-muted hover:text-exam-ink text-sm transition-colors">
            View your OMR sheet
          </button>
        )}
        {r.solutionsHref && (
          <a href={r.solutionsHref} className="inline-flex items-center px-5 py-2.5 rounded-xl bg-exam-maroon hover:bg-exam-maroon-bright text-exam-ink text-sm font-medium transition-colors">
            View solutions
          </a>
        )}
        {r.solutionUrl && (
          <a href={r.solutionUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-5 py-2.5 rounded-xl bg-exam-maroon hover:bg-exam-maroon-bright text-exam-ink text-sm font-medium transition-colors">
            Solutions PDF
          </a>
        )}
      </div>
      {sheetError && <p className="text-red-400 text-sm">{sheetError}</p>}
    </>
  );
}

export default function MockResultsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [result, setResult] = useState<MockResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/mocks/${slug}/result`)
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? 'Could not load this result.');
          return;
        }
        setResult(await res.json());
      })
      .catch(() => setError('Network error — check your connection.'));
  }, [slug]);

  if (error) return <Shell title="Mock result"><p className="text-red-400">{error}</p></Shell>;
  if (!result) return <Shell title="Mock result"><p className="text-exam-ink-muted">Loading…</p></Shell>;

  if (result.phase === 'locked') {
    return (
      <Shell title={result.title}>
        <p className="text-exam-ink-muted">Your result isn’t available yet. Your MCQ score, answers and the answer key appear as soon as the mock’s windows close; your final rank is published once every copy and essay has been marked.</p>
      </Shell>
    );
  }

  if (result.phase === 'provisional') {
    return (
      <Shell title={result.title}>
        <div className="rounded-2xl border border-exam-warning/40 bg-exam-warning/10 p-4 text-sm text-exam-ink mb-6">
          <strong>Provisional.</strong> This is your own MCQ entry. Essay marks and your final rank arrive with the final results, and you will get an email when they are out.
        </div>
        <section className={`${card} mb-6`}>
          <p className={h2}>Part 1 · your entry</p>
          <p className="font-serif text-5xl font-semibold tabular-nums">
            {num(result.mcq.score)}<span className="text-exam-ink-faint text-2xl"> / {num(result.mcq.maxScore)}</span>
          </p>
          <p className="text-exam-ink-muted text-sm mt-2">{result.mcq.correct} right · {result.mcq.wrong} wrong · {result.mcq.unattempted} skipped</p>
        </section>
        <Sections mcq={result.mcq} missed={null} />
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={result.reviewHref} className="inline-flex items-center px-5 py-2.5 rounded-xl bg-exam-maroon hover:bg-exam-maroon-bright text-exam-ink text-sm font-medium transition-colors">
            See your answers and the keys →
          </Link>
          {result.solutionsHref && (
            <a href={result.solutionsHref} className="inline-flex items-center px-5 py-2.5 rounded-xl bg-exam-maroon hover:bg-exam-maroon-bright text-exam-ink text-sm font-medium transition-colors">
              View solutions
            </a>
          )}
          {result.solutionUrl && (
            <a href={result.solutionUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-5 py-2.5 rounded-xl bg-exam-elevated border border-exam-border text-exam-ink-muted hover:text-exam-ink text-sm transition-colors">
              Solutions PDF
            </a>
          )}
        </div>
      </Shell>
    );
  }

  return (
    <Shell title={result.title}>
      <div className="space-y-6"><Official r={result} slug={slug} /></div>
    </Shell>
  );
}

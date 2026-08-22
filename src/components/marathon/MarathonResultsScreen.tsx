'use client';

import { useState } from 'react';
import Link from 'next/link';
import RichText from '@/components/workbook/RichText';
import { Button } from '@/components/ui/button';
import type { MarathonResultsPayload } from '@/lib/marathon/types';

function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export default function MarathonResultsScreen({ results }: { results: MarathonResultsPayload }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggle = (id: number) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const { attempt, questions, subtopicWeakness } = results;

  return (
    <div className="min-h-screen bg-exam-base text-exam-ink">
      <div className="border-b border-exam-border bg-exam-surface">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <p className="text-exam-gold text-xs font-bold uppercase tracking-widest mb-2">{results.chapter.title} · Day {results.day.dayNumber}</p>
          <h1 className="font-serif text-3xl font-semibold mb-4">Results</h1>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Correct" value={attempt.totalCorrect} accent="text-emerald-400" />
            <Stat label="Wrong" value={attempt.totalWrong} accent="text-red-400" />
            <Stat label="Skipped" value={attempt.totalSkipped} accent="text-exam-ink-muted" />
            <Stat label="Time" value={formatClock(attempt.totalActiveMs)} accent={attempt.isOverallSlow ? 'text-amber-400' : 'text-exam-ink'} />
          </div>
          {attempt.isOverallSlow && (
            <p className="mt-3 text-sm text-amber-400 bg-amber-950/30 border border-amber-900/50 rounded-lg px-3 py-2">
              ⚠ You took noticeably longer than most of the class on this day overall — worth reviewing your pacing.
            </p>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {subtopicWeakness.length > 0 && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wide text-exam-ink-faint mb-3">Weakest subtopics (this chapter so far)</h2>
            <div className="bg-exam-elevated border border-exam-border rounded-xl divide-y divide-exam-border">
              {subtopicWeakness.slice(0, 8).map(s => (
                <div key={s.code} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <p className="text-sm text-exam-ink">{s.label}</p>
                    <p className="text-[11px] text-exam-ink-faint">{s.code} · {s.correct}/{s.total} correct</p>
                  </div>
                  <p className={`text-sm font-semibold ${s.accuracy < 50 ? 'text-red-400' : s.accuracy < 75 ? 'text-amber-400' : 'text-emerald-400'}`}>{s.accuracy}%</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-exam-ink-faint mb-3">Question-by-question</h2>
          <div className="space-y-3">
            {questions.map(q => {
              const isOpen = expanded.has(q.id);
              const outcome = q.isCorrect === null ? 'skipped' : q.isCorrect ? 'correct' : 'wrong';
              return (
                <div key={q.id} className="bg-exam-elevated border border-exam-border rounded-xl overflow-hidden">
                  <button onClick={() => toggle(q.id)} className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={[
                        'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                        outcome === 'correct' ? 'bg-emerald-500/20 text-emerald-400' :
                        outcome === 'wrong' ? 'bg-red-500/20 text-red-400' : 'bg-exam-surface text-exam-ink-faint',
                      ].join(' ')}>{q.number}</span>
                      <span className="text-sm text-exam-ink-muted truncate">
                        {outcome === 'correct' ? 'Correct' : outcome === 'wrong' ? `Wrong · picked ${q.selectedKey}` : 'Skipped'}
                        {q.isSlow && <span className="text-amber-400 ml-2">⚠ slow</span>}
                      </span>
                    </div>
                    <span className="text-xs text-exam-ink-faint flex-shrink-0">{formatClock(q.timeSpentMs)}</span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 border-t border-exam-border pt-4">
                      <div className="text-sm leading-relaxed mb-3"><RichText content={q.stem} /></div>
                      <div className="space-y-1.5 mb-4">
                        {q.options.map(opt => (
                          <div key={opt.key} className={[
                            'text-sm px-3 py-2 rounded-lg border flex items-start gap-2',
                            opt.key === q.correctKey ? 'border-emerald-600/50 bg-emerald-500/10' :
                            opt.key === q.selectedKey ? 'border-red-600/50 bg-red-500/10' : 'border-exam-border',
                          ].join(' ')}>
                            <span className="font-bold text-exam-ink-faint">{opt.key}.</span>
                            <span className="flex-1"><RichText content={opt.text} inline /></span>
                            {opt.key === q.correctKey && <span className="text-emerald-400 text-xs font-bold">✓ Answer</span>}
                          </div>
                        ))}
                      </div>
                      {(q.primaryTag || q.secondaryTag) && (
                        <p className="text-[11px] text-exam-ink-faint mb-3">
                          {[q.primaryTag?.label, q.secondaryTag?.label].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      <div className="bg-exam-surface border border-exam-border rounded-lg p-3 mb-3">
                        <p className="text-xs font-bold text-exam-gold mb-1.5">Solution</p>
                        {q.solution ? (
                          <div className="text-sm text-exam-ink-muted leading-relaxed"><RichText content={q.solution} /></div>
                        ) : (
                          <p className="text-sm text-exam-ink-faint italic">Solution coming soon.</p>
                        )}
                      </div>
                      <p className="text-[11px] text-exam-ink-faint">
                        Class: {q.classStats.correctCount} correct · {q.classStats.wrongCount} wrong · {q.classStats.skippedCount} skipped
                        {q.classStats.medianTimeMs > 0 && <> · median time {formatClock(q.classStats.medianTimeMs)}</>}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <Link href="/marathon"><Button variant="outline">Back to Marathon</Button></Link>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="bg-exam-elevated border border-exam-border rounded-lg px-3 py-2.5">
      <p className={`text-xl font-bold ${accent}`}>{value}</p>
      <p className="text-[11px] text-exam-ink-faint uppercase tracking-wide">{label}</p>
    </div>
  );
}

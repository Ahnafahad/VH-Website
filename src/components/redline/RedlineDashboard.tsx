'use client';

import type { ReactNode } from 'react';
import type { RedlineAnalysis, ResponseClass, SkillState } from '@/lib/redline/types';
import { CLASS_COPY } from './RevealPanel';

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);
const secs = (ms: number | null) => (ms === null ? '—' : `${Math.round(ms / 1000)}s`);

const STATE_BAR: Record<SkillState, string> = {
  weak: 'bg-exam-danger', developing: 'bg-exam-warning', strong: 'bg-exam-success', insufficient: 'bg-exam-q-blank',
};
const STATE_LABEL: Record<SkillState, string> = {
  weak: 'Needs work', developing: 'Developing', strong: 'Strong', insufficient: 'Not enough data',
};
const CLASS_BAR: Record<ResponseClass, string> = {
  mastered: 'bg-exam-success', fragile: 'bg-exam-warning', lucky: 'bg-exam-gold', slip: 'bg-sky-400',
  gap: 'bg-exam-maroon-bright', misconception: 'bg-exam-danger',
};
const CLASS_ORDER: ResponseClass[] = ['mastered', 'fragile', 'lucky', 'slip', 'gap', 'misconception'];

function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="font-serif text-xl font-semibold text-exam-ink">{title}</h3>
      {sub && <p className="text-sm text-exam-ink-muted mt-1 mb-4 max-w-2xl">{sub}</p>}
      {!sub && <div className="mb-4" />}
      {children}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-exam-border bg-exam-surface p-4">
      <p className="font-serif text-3xl text-exam-ink tabular-nums">{value}</p>
      <p className="text-xs font-semibold text-exam-ink-muted mt-1">{label}</p>
      {hint && <p className="text-[11px] text-exam-ink-faint mt-0.5 leading-snug">{hint}</p>}
    </div>
  );
}

function Bar({ value, className }: { value: number; className: string }) {
  return (
    <div className="h-2 rounded-full bg-exam-q-blank overflow-hidden">
      <div className={`h-full rounded-full ${className}`} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  );
}

export default function RedlineDashboard({ analysis: a, heading = true }: { analysis: RedlineAnalysis; heading?: boolean }) {
  if (a.answered === 0) {
    return (
      <div className="rounded-xl border border-dashed border-exam-border p-8 text-center">
        <p className="font-serif text-lg text-exam-ink">Your dashboard starts with your first level.</p>
        <p className="text-sm text-exam-ink-muted mt-2 max-w-md mx-auto">
          Finish Level 1 and this space fills with a map of your skills, the mistakes you repeat, and how you answer under pressure.
        </p>
      </div>
    );
  }

  const early = a.answered < 20;
  const sorted = [...a.skills].sort((x, y) => {
    const rank = (s: SkillState) => (s === 'insufficient' ? 1 : 0);
    return rank(x.state) - rank(y.state) || (x.state === 'insufficient' ? y.answered - x.answered : x.mastery - y.mastery);
  });
  const b = a.behavior;

  return (
    <div className="space-y-12">
      {heading && (
        <div>
          <p className="text-exam-gold text-xs font-bold uppercase tracking-widest mb-2">Your dashboard</p>
          <p className="text-sm text-exam-ink-muted max-w-2xl">
            Built from your first attempt at each level: what you chose, how sure you were, whether you needed hints, and how you did on follow-ups.
          </p>
        </div>
      )}

      {early && (
        <div className="rounded-xl border border-exam-warning/40 bg-exam-warning/10 p-4 text-sm text-exam-ink-muted">
          Early read: {a.answered} answers so far. Skill scores are cautious until each skill has a few answers behind it.
        </div>
      )}

      {/* Summary */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Overall mastery" value={a.mastery === null ? '—' : `${a.mastery}`} hint="Weighted by confidence, hints and difficulty" />
          <Stat label="Accuracy" value={pct(a.accuracy)} hint={`${a.correct} of ${a.answered} correct`} />
          <Stat label="Levels finished" value={`${a.levelsDone}`} />
          <Stat label="Typical time" value={secs(b.medianTimeMs)} hint="Median per question" />
        </div>
        <div>
          <p className="text-xs font-semibold text-exam-ink-muted mb-2">How your answers read</p>
          <div className="flex h-3 rounded-full overflow-hidden bg-exam-q-blank" role="img"
            aria-label={CLASS_ORDER.map(k => `${a.classes[k]} ${CLASS_COPY[k].title}`).join(', ')}>
            {CLASS_ORDER.map(k => a.classes[k] > 0 && (
              <div key={k} className={CLASS_BAR[k]} style={{ width: `${(a.classes[k] / a.answered) * 100}%` }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {CLASS_ORDER.filter(k => a.classes[k] > 0).map(k => (
              <span key={k} className="flex items-center gap-1.5 text-xs text-exam-ink-muted">
                <span className={`w-2.5 h-2.5 rounded-sm ${CLASS_BAR[k]}`} />{CLASS_COPY[k].title} {a.classes[k]}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Priorities */}
      {a.weaknesses.length > 0 && (
        <Section title="What to work on first" sub="Ranked by how much each costs you, counting confident mistakes more heavily than unsure ones.">
          <div className="space-y-3">
            {a.weaknesses.map((w, i) => (
              <div key={`${w.kind}-${w.id}`} className="rounded-xl border border-exam-border bg-exam-surface p-4">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-exam-maroon-bright text-exam-ink text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <div className="min-w-0 space-y-2">
                    <p className="font-semibold text-exam-ink">{w.headline}</p>
                    <ul className="text-sm text-exam-ink-muted space-y-1 list-disc pl-4">
                      {w.points.map((p, j) => <li key={j}>{p}</li>)}
                    </ul>
                    {w.howCatch && (
                      <div className="rounded-lg border border-exam-gold/30 bg-exam-gold/5 p-3 text-sm space-y-1.5">
                        {w.whyMiss && <p className="text-exam-ink-muted"><span className="font-semibold text-exam-ink">Why this trips people up: </span>{w.whyMiss}</p>}
                        <p className="text-exam-ink-muted"><span className="font-semibold text-exam-gold">How to catch it: </span>{w.howCatch}</p>
                      </div>
                    )}
                    {w.questionNumbers.length > 0 && <p className="text-xs text-exam-ink-faint">Recent misses: worksheet Q{w.questionNumbers.join(', Q')}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Skill map */}
      <Section title="Skill map" sub="Mastery per skill, weakest first. The shaded margin shrinks as evidence builds; greyed skills have too few answers to judge.">
        <div className="rounded-xl border border-exam-border bg-exam-surface divide-y divide-exam-border">
          {sorted.map(s => (
            <div key={s.id} className={`p-3.5 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 ${s.state === 'insufficient' ? 'opacity-55' : ''}`}>
              <div className="flex items-baseline justify-between gap-3 min-w-0">
                <p className="text-sm font-semibold text-exam-ink truncate">{s.label}</p>
                <p className="text-[11px] text-exam-ink-faint whitespace-nowrap">{s.answered} answered</p>
              </div>
              <p className="text-sm tabular-nums text-exam-ink text-right">
                {s.state === 'insufficient' ? '—' : <>{s.mastery}<span className="text-exam-ink-faint text-xs"> ±{s.margin}</span></>}
              </p>
              <div className="col-span-2"><Bar value={s.state === 'insufficient' ? 0 : s.mastery} className={STATE_BAR[s.state]} /></div>
              <div className="col-span-2 flex items-center justify-between text-[11px] text-exam-ink-faint">
                <span>{STATE_LABEL[s.state]}</span>
                {s.trend !== null && <span className={s.trend >= 5 ? 'text-exam-success' : s.trend <= -5 ? 'text-exam-danger' : ''}>{s.trend > 0 ? '▲' : s.trend < 0 ? '▼' : '■'} {Math.abs(s.trend)} pts vs. earlier</span>}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Error patterns */}
      {a.families.length > 0 && (
        <Section title="Mistakes you repeat" sub="The type of wrong option you pick, across all skills. Confident picks are habits worth breaking.">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-exam-border bg-exam-surface p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-exam-gold">Error types</p>
              {a.families.slice(0, 6).map(f => (
                <div key={f.id}>
                  <div className="flex justify-between text-sm mb-1"><span className="text-exam-ink">{f.label}</span><span className="tabular-nums text-exam-ink-muted">{f.count}×</span></div>
                  <Bar value={f.share * 100 * 2.5} className="bg-exam-maroon-bright" />
                  {f.confidentShare >= 0.4 && <p className="text-[11px] text-exam-danger mt-0.5">{pct(f.confidentShare)} picked while sure</p>}
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-exam-border bg-exam-surface p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-exam-gold">How the traps work on you</p>
              {a.traps.filter(t => t.count > 0).slice(0, 6).map(t => (
                <div key={t.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-exam-ink">{t.label}</span>
                  <span className={`text-xs tabular-nums whitespace-nowrap ${t.count >= 4 && t.overIndex >= 1.4 ? 'text-exam-danger font-semibold' : 'text-exam-ink-faint'}`}>
                    {t.count}× · {t.overIndex.toFixed(1)}× chance
                  </span>
                </div>
              ))}
              <p className="text-[11px] text-exam-ink-faint leading-snug">Above 1× means you choose this kind of wrong option more often than its share of the options offered.</p>
            </div>
          </div>
        </Section>
      )}

      {/* Behaviour */}
      <Section title="How you answer" sub="Habits that show up in your timing, confidence and second-guessing, independent of grammar topic.">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Stat label="When you say Sure" value={pct(b.sureAccuracy)} hint={b.sureCount >= 5 ? `right across ${b.sureCount} answers` : 'needs 5+ answers'} />
          <Stat label="Guess rate" value={pct(b.guessRate)} />
          <Stat label="Hints opened" value={pct(b.hintRate)} hint={b.hintAccuracy !== null ? `${pct(b.hintAccuracy)} right with a hint` : undefined} />
          <Stat label="Changed answer" value={pct(b.changedRate)} hint={b.changedAccuracy !== null ? `${pct(b.changedAccuracy)} right when changed` : undefined} />
        </div>
        {a.insights.length > 0 && (
          <ul className="space-y-2">
            {a.insights.map((t, i) => (
              <li key={i} className="rounded-xl border border-exam-border bg-exam-elevated px-4 py-3 text-sm text-exam-ink-muted leading-relaxed">{t}</li>
            ))}
          </ul>
        )}
      </Section>

      {/* Trend */}
      {a.levelTrend.length >= 2 && (
        <Section title="Level by level" sub="Accuracy on your first attempt at each level. Later levels are harder, so a flat line is progress.">
          <TrendChart points={a.levelTrend} />
        </Section>
      )}

      {a.strengths.length > 0 && (
        <p className="text-sm text-exam-ink-muted">
          <span className="font-semibold text-exam-ink">Your strongest skills: </span>
          {a.strengths.map(s => `${s.label} (${s.mastery})`).join(', ')}.
        </p>
      )}
    </div>
  );
}

function TrendChart({ points }: { points: RedlineAnalysis['levelTrend'] }) {
  const W = 640, H = 160, PX = 28, PY = 14;
  const xs = (i: number) => PX + (points.length === 1 ? 0 : (i / (points.length - 1)) * (W - 2 * PX));
  const ys = (v: number) => H - PY - (v / 100) * (H - 2 * PY);
  const line = (key: 'accuracy' | 'masteredShare') => points.map((p, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(p[key]).toFixed(1)}`).join(' ');
  return (
    <div className="rounded-xl border border-exam-border bg-exam-surface p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Accuracy per level">
        {[0, 50, 100].map(v => (
          <g key={v}>
            <line x1={PX} x2={W - PX} y1={ys(v)} y2={ys(v)} stroke="var(--color-exam-border)" strokeWidth="1" />
            <text x={4} y={ys(v) + 3} fontSize="10" fill="var(--color-exam-ink-faint)">{v}</text>
          </g>
        ))}
        <path d={line('masteredShare')} fill="none" stroke="var(--color-exam-gold)" strokeWidth="1.5" strokeDasharray="4 3" />
        <path d={line('accuracy')} fill="none" stroke="var(--color-exam-success)" strokeWidth="2.5" />
        {points.map((p, i) => (
          <g key={p.level}>
            <circle cx={xs(i)} cy={ys(p.accuracy)} r="3.5" fill="var(--color-exam-success)" />
            <text x={xs(i)} y={H - 1} fontSize="10" textAnchor="middle" fill="var(--color-exam-ink-faint)">{p.level}</text>
          </g>
        ))}
      </svg>
      <div className="flex gap-4 text-xs text-exam-ink-muted mt-1">
        <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-exam-success" />Accuracy %</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-exam-gold" />Solid answers % (correct, sure, unaided)</span>
      </div>
    </div>
  );
}

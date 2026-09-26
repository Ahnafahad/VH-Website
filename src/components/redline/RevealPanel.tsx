'use client';

import { useState } from 'react';
import type { RedlineReveal, ResponseClass } from '@/lib/redline/types';

export const CLASS_COPY: Record<ResponseClass, { title: string; tone: 'good' | 'warn' | 'bad'; line: string }> = {
  mastered:      { title: 'Solid',              tone: 'good', line: 'Correct, confident and unaided.' },
  fragile:       { title: 'Correct, but shaky', tone: 'warn', line: 'Right answer, though you were unsure, used a hint or switched. Lock in the rule below.' },
  lucky:         { title: 'Lucky',              tone: 'warn', line: 'Right answer, but you marked it a guess. Make sure you could explain it.' },
  slip:          { title: 'A slip',             tone: 'warn', line: 'You solved the follow-up, so you know this rule. This one got past you.' },
  gap:           { title: 'A gap',              tone: 'bad',  line: 'You were unsure here, and that was the right instinct. This is worth studying.' },
  misconception: { title: 'Confident miss',     tone: 'bad',  line: 'You were sure, and it was wrong. This is the most valuable thing to fix.' },
};

const TONE_CLASS = {
  good: 'border-exam-success/60 bg-exam-success/10',
  warn: 'border-exam-warning/60 bg-exam-warning/10',
  bad: 'border-exam-danger/60 bg-exam-danger/10',
} as const;

function Fold({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-exam-border bg-exam-surface">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-semibold text-exam-ink-muted hover:text-exam-ink"
        aria-expanded={open}
      >
        {title}
        <span className="text-exam-ink-faint text-xs">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && <div className="px-4 pb-4 text-sm leading-relaxed text-exam-ink-muted space-y-3">{children}</div>}
    </div>
  );
}

interface Props {
  reveal: RedlineReveal;
  options: Record<string, string>;
}

export default function RevealPanel({ reveal, options }: Props) {
  const copy = CLASS_COPY[reveal.klass];
  const picked = reveal.selectedKey ? reveal.distractors[reveal.selectedKey] : null;
  const keys = Object.keys(options);

  return (
    <div className="space-y-3">
      <div className={`rounded-xl border p-4 ${TONE_CLASS[copy.tone]}`}>
        <p className="text-sm font-bold text-exam-ink">
          {reveal.isCorrect ? 'Correct' : reveal.selectedKey ? 'Not quite' : 'Skipped'} · {copy.title}
        </p>
        <p className="text-sm text-exam-ink-muted mt-1">{copy.line}</p>
        <p className="text-xs text-exam-ink-faint mt-2">Skill: {reveal.skillLabel}</p>
      </div>

      {!reveal.isCorrect && picked && picked.status === 'incorrect' && (
        <div className="rounded-xl border border-exam-border bg-exam-elevated p-4 text-sm leading-relaxed">
          <p className="text-xs font-bold uppercase tracking-widest text-exam-gold mb-2">Why option {reveal.selectedKey} tempted you</p>
          {picked.attraction && <p className="text-exam-ink-muted">{picked.attraction}</p>}
          {picked.issue && <p className="text-exam-ink mt-2"><span className="font-semibold">What is wrong with it: </span>{picked.issue}</p>}
          {(picked.familyLabel || picked.trapLabel) && (
            <p className="text-xs text-exam-ink-faint mt-2">
              {picked.familyLabel && <>Error type: {picked.familyLabel}. </>}
              {picked.trapLabel && <>Trap: {picked.trapLabel}.</>}
            </p>
          )}
        </div>
      )}

      <div className="rounded-xl border border-exam-border bg-exam-elevated p-4 text-sm leading-relaxed">
        <p className="text-xs font-bold uppercase tracking-widest text-exam-gold mb-2">Answer: {reveal.correctKey}</p>
        <p className="text-exam-ink">{reveal.proof}</p>
        <p className="text-exam-ink-muted mt-3">{reveal.explanation}</p>
      </div>

      <div className="rounded-xl border border-exam-gold/40 bg-exam-gold/5 p-4 text-sm leading-relaxed">
        <p className="text-xs font-bold uppercase tracking-widest text-exam-gold mb-2">How to catch it next time</p>
        <p className="text-exam-ink">{reveal.howCatch}</p>
      </div>

      <Fold title="Go deeper: the rule behind this">
        <p>{reveal.deeper}</p>
        <p><span className="font-semibold text-exam-ink">Why students miss it: </span>{reveal.whyMiss}</p>
      </Fold>

      <Fold title="All five options, one by one">
        <ul className="space-y-3">
          {keys.map(k => {
            const d = reveal.distractors[k];
            const isKey = k === reveal.correctKey;
            return (
              <li key={k} className="flex gap-3">
                <span className={`flex-shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${isKey ? 'bg-exam-success text-white' : 'bg-exam-elevated border border-exam-border text-exam-ink-faint'}`}>{k}</span>
                <div>
                  <p className="text-exam-ink">{options[k]}</p>
                  <p className="text-exam-ink-muted mt-0.5">{isKey ? (d.reason ?? 'The correct choice.') : d.issue}</p>
                </div>
              </li>
            );
          })}
        </ul>
        {reveal.closestCompetitor && reveal.closestCompetitor !== reveal.correctKey && (
          <p className="text-xs text-exam-ink-faint">Closest competitor: option {reveal.closestCompetitor}.</p>
        )}
      </Fold>

      {(reveal.meaning || reveal.xray.length > 0) && (
        <Fold title="Break the sentence down">
          {reveal.meaning && <p><span className="font-semibold text-exam-ink">In plain words: </span>{reveal.meaning}</p>}
          <ul className="space-y-1.5">
            {reveal.xray.map((x, i) => (
              <li key={i}><span className="text-exam-gold text-xs font-semibold uppercase tracking-wide">{x.label}</span> <span className="text-exam-ink">{x.text}</span></li>
            ))}
          </ul>
        </Fold>
      )}
    </div>
  );
}

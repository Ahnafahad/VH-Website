'use client';

import type { ResultsPayload, TakingSection, Option } from '@/lib/tests/types';

type QuestionAnalytics = ResultsPayload['questionAnalytics'];
type Responses = NonNullable<ResultsPayload['me']>['responses'];
type AnswerKey = ResultsPayload['answerKey'];

interface Props {
  sections: TakingSection[];
  questionAnalytics: QuestionAnalytics;
  responses: Responses;
  answerKey: AnswerKey;
}

interface ScoredQuestion {
  id: number;
  number: number;
  stem: string;
  options: Option[];
  classCorrectRate: number; // 0–1, correct / (correct + wrong)
  selected: string | null;
  correct: string | null;
  skipped: boolean;
}

// Class correct-rate at/above this reads a skip as time pressure rather than a knowledge gap.
const TIME_PRESSURE_CUTOFF = 0.5;

function buildScored(sections: TakingSection[], analytics: QuestionAnalytics, responses: Responses, answerKey: AnswerKey): ScoredQuestion[] {
  const out: ScoredQuestion[] = [];
  for (const sec of sections) {
    for (const q of sec.questions) {
      const a = analytics[q.id];
      if (!a) continue;
      const total = a.correctCount + a.wrongCount;
      if (total === 0) continue;
      const resp = responses[q.id];
      out.push({
        id: q.id,
        number: q.number,
        stem: q.stem,
        options: q.options,
        classCorrectRate: a.correctCount / total,
        selected: resp?.selected ?? null,
        correct: answerKey[q.id] ?? null,
        skipped: resp?.selected == null,
      });
    }
  }
  return out;
}

function getOpportunities(scored: ScoredQuestion[], responses: Responses, count = 3): ScoredQuestion[] {
  const missed = scored.filter(q => responses[q.id]?.isCorrect !== true);
  return [...missed].sort((a, b) => b.classCorrectRate - a.classCorrectRate).slice(0, count);
}

function getStandouts(scored: ScoredQuestion[], responses: Responses, count = 3): ScoredQuestion[] {
  const gotRight = scored.filter(q => responses[q.id]?.isCorrect === true);
  return [...gotRight].sort((a, b) => a.classCorrectRate - b.classCorrectRate).slice(0, count);
}

function getSkipSentence(scored: ScoredQuestion[]): string | null {
  const skipped = scored.filter(q => q.skipped);
  if (skipped.length === 0) return null;

  const timePressure = skipped.filter(q => q.classCorrectRate >= TIME_PRESSURE_CUTOFF);
  const widelyMissed = skipped.filter(q => q.classCorrectRate < TIME_PRESSURE_CUTOFF);

  if (skipped.length === 1) {
    const q = skipped[0];
    return q.classCorrectRate >= TIME_PRESSURE_CUTOFF
      ? `You skipped Q${q.number}, which ${Math.round(q.classCorrectRate * 100)}% of the class got right — likely ran out of time, not a knowledge gap.`
      : `You skipped Q${q.number}, which only ${Math.round(q.classCorrectRate * 100)}% of the class got right — a reasonable call, most people struggled here too.`;
  }

  if (timePressure.length > 0 && widelyMissed.length === 0) {
    return `You skipped ${skipped.length} questions that most of the class actually got right (${timePressure.map(q => `Q${q.number}`).join(', ')}) — likely time pressure, not a knowledge gap.`;
  }
  if (widelyMissed.length > 0 && timePressure.length === 0) {
    return `You skipped ${skipped.length} questions — most of the class struggled with these too, a reasonable call.`;
  }
  return `You skipped ${skipped.length} questions: ${timePressure.length} that most of the class got right (likely time pressure) and ${widelyMissed.length} that tripped up most of the class too (a reasonable call).`;
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function QuestionCard({ q, tone }: { q: ScoredQuestion; tone: 'opportunity' | 'standout' }) {
  const shortStem = q.stem.length > 100 ? q.stem.slice(0, 100) + '…' : q.stem;
  const pct = Math.round(q.classCorrectRate * 100);
  const color = tone === 'opportunity' ? 'var(--color-exam-danger)' : 'var(--color-exam-success)';
  const reasoning = tone === 'opportunity'
    ? (q.skipped ? `${pct}% of the class got this right — you skipped it` : `${pct}% of the class got this right — you didn't`)
    : `Only ${pct}% of the class got this right — you did`;

  return (
    <a
      href={`#q-${q.id}`}
      className="flex items-start gap-3 p-4 rounded-xl hover:brightness-110 transition-all"
      style={{ background: 'var(--color-exam-surface)', border: '1px solid var(--color-exam-border)', textDecoration: 'none' }}
    >
      <div
        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
        style={{ background: 'var(--color-exam-elevated)', color }}
      >
        Q{q.number}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium mb-1" style={{ color }}>{reasoning}</p>
        <p className="text-[var(--color-exam-ink-muted)] text-xs leading-relaxed line-clamp-2">{shortStem}</p>
      </div>
    </a>
  );
}

// ─── Strip ────────────────────────────────────────────────────────────────────

export default function StrategyStrip({ sections, questionAnalytics, responses, answerKey }: Props) {
  const scored = buildScored(sections, questionAnalytics, responses, answerKey);
  const opportunities = getOpportunities(scored, responses);
  const standouts = getStandouts(scored, responses);
  const skipSentence = getSkipSentence(scored);

  if (opportunities.length === 0 && standouts.length === 0 && !skipSentence) return null;

  return (
    <div>
      <h2 className="text-[var(--color-exam-ink-faint)] text-xs tracking-[0.18em] uppercase mb-4">
        Your Strategy Read
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {opportunities.length > 0 && (
          <div>
            <p className="text-[var(--color-exam-ink-muted)] text-xs font-medium mb-3">Biggest Opportunities</p>
            <div className="space-y-3">
              {opportunities.map(q => <QuestionCard key={q.id} q={q} tone="opportunity" />)}
            </div>
          </div>
        )}
        {standouts.length > 0 && (
          <div>
            <p className="text-[var(--color-exam-ink-muted)] text-xs font-medium mb-3">Standout Answers</p>
            <div className="space-y-3">
              {standouts.map(q => <QuestionCard key={q.id} q={q} tone="standout" />)}
            </div>
          </div>
        )}
      </div>

      {skipSentence && (
        <p className="mt-4 text-[var(--color-exam-ink-faint)] text-xs leading-relaxed">
          {skipSentence}
        </p>
      )}
    </div>
  );
}

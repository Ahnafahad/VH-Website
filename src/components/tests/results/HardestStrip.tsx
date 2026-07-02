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

interface HardQuestion {
  id: number;
  number: number;
  stem: string;
  difficulty: number;  // wrongRate 0–1
  options: Option[];
  selected: string | null;
  correct: string | null;
}

function getHardest(
  sections: TakingSection[],
  analytics: QuestionAnalytics,
  responses: Responses,
  answerKey: AnswerKey,
  count = 5,
): HardQuestion[] {
  const candidates: HardQuestion[] = [];

  for (const sec of sections) {
    for (const q of sec.questions) {
      const a = analytics[q.id];
      if (!a) continue;
      const total = a.correctCount + a.wrongCount;
      if (total === 0) continue;
      const wrongRate = a.wrongCount / total;
      const resp = responses[q.id];
      candidates.push({
        id: q.id,
        number: q.number,
        stem: q.stem,
        difficulty: wrongRate,
        options: q.options,
        selected: resp?.selected ?? null,
        correct: answerKey[q.id] ?? null,
      });
    }
  }

  candidates.sort((a, b) => b.difficulty - a.difficulty);
  return candidates.slice(0, count);
}

// ─── Difficulty ring ──────────────────────────────────────────────────────────

function DifficultyRing({ rate }: { rate: number }) {
  const r = 14;
  const circ = 2 * Math.PI * r;
  const dash = rate * circ;
  const color = rate > 0.7 ? 'var(--color-exam-danger)' : rate > 0.4 ? 'var(--color-exam-warning)' : 'var(--color-exam-success)';

  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="shrink-0">
      <circle cx="18" cy="18" r={r} fill="none" stroke="var(--color-exam-border)" strokeWidth="2.5" />
      <circle
        cx="18" cy="18" r={r}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ - dash}
        transform="rotate(-90 18 18)"
      />
      <text x="18" y="22" textAnchor="middle" fill={color} fontSize="8" fontWeight="700">
        {Math.round(rate * 100)}%
      </text>
    </svg>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function HardCard({ q, idx }: { q: HardQuestion; idx: number }) {
  const shortStem = q.stem.length > 100 ? q.stem.slice(0, 100) + '…' : q.stem;
  const isCorrect = q.selected !== null && q.selected === q.correct;
  const isWrong   = q.selected !== null && q.selected !== q.correct;

  return (
    <a
      href={`#q-${q.id}`}
      className="flex items-start gap-3 p-4 rounded-xl hover:brightness-110 transition-all group"
      style={{
        background: 'var(--color-exam-surface)',
        border: '1px solid var(--color-exam-border)',
        textDecoration: 'none',
      }}
    >
      {/* Rank badge */}
      <div
        className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
        style={{ background: 'var(--color-exam-elevated)', color: 'var(--color-exam-ink-muted)' }}
      >
        {idx + 1}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[var(--color-exam-ink-faint)] text-xs">Q{q.number}</span>
          {isCorrect && <span className="text-[var(--color-exam-success)] text-xs">✓ You got it</span>}
          {isWrong   && <span className="text-[var(--color-exam-danger)] text-xs">✗ {q.selected} → {q.correct}</span>}
          {!q.selected && q.correct && <span className="text-[var(--color-exam-ink-faint)] text-xs">Skipped · ans {q.correct}</span>}
        </div>
        <p className="text-[var(--color-exam-ink-muted)] text-xs leading-relaxed line-clamp-2">{shortStem}</p>
      </div>

      <DifficultyRing rate={q.difficulty} />
    </a>
  );
}

// ─── Strip ────────────────────────────────────────────────────────────────────

export default function HardestStrip({ sections, questionAnalytics, responses, answerKey }: Props) {
  const hard = getHardest(sections, questionAnalytics, responses, answerKey);
  if (hard.length === 0) return null;

  return (
    <div>
      <h2 className="text-[var(--color-exam-ink-faint)] text-xs tracking-[0.18em] uppercase mb-4">
        Hardest Questions
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {hard.map((q, i) => (
          <HardCard key={q.id} q={q} idx={i} />
        ))}
      </div>
      <p className="mt-3 text-[var(--color-exam-ink-faint)] text-xs">
        Ranked by class wrong-rate · ring = % of class who got it wrong · click to jump to review
      </p>
    </div>
  );
}

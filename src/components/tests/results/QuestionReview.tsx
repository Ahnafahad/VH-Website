'use client';

import { useState } from 'react';
import RichText from '@/components/workbook/RichText';
import type { ResultsPayload, TakingSection, TakingGroup, Option } from '@/lib/tests/types';

type QuestionAnalytics = ResultsPayload['questionAnalytics'];
type Responses = NonNullable<ResultsPayload['me']>['responses'];
type AnswerKey = ResultsPayload['answerKey'];

interface Props {
  sections: TakingSection[];
  responses: Responses;
  answerKey: AnswerKey;
  questionAnalytics: QuestionAnalytics;
}

// ─── Answer status chip ───────────────────────────────────────────────────────

type Status = 'correct' | 'wrong' | 'skipped' | 'no-attempt';

function statusProps(status: Status): { label: string; color: string } {
  switch (status) {
    case 'correct':    return { label: '✓ Correct',  color: 'var(--color-exam-success)' };
    case 'wrong':      return { label: '✗ Wrong',    color: 'var(--color-exam-danger)'  };
    case 'skipped':    return { label: '— Skipped',  color: 'var(--color-exam-ink-faint)' };
    case 'no-attempt': return { label: '— No attempt', color: 'var(--color-exam-ink-faint)' };
  }
}

function StatusChip({ status }: { status: Status }) {
  const { label, color } = statusProps(status);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      {label}
    </span>
  );
}

// ─── Option row ───────────────────────────────────────────────────────────────

function OptionRow({
  opt,
  isSelected,
  isCorrect,
  hasAttempt,
}: {
  opt: Option;
  isSelected: boolean;
  isCorrect: boolean;
  hasAttempt: boolean;
}) {
  let border = 'var(--color-exam-border)';
  let bg     = 'transparent';
  let keyColor = 'var(--color-exam-ink-faint)';

  if (isCorrect) {
    border = 'var(--color-exam-success)';
    bg     = 'color-mix(in srgb, var(--color-exam-success) 10%, transparent)';
    keyColor = 'var(--color-exam-success)';
  } else if (isSelected && !isCorrect) {
    border = 'var(--color-exam-danger)';
    bg     = 'color-mix(in srgb, var(--color-exam-danger) 10%, transparent)';
    keyColor = 'var(--color-exam-danger)';
  }

  return (
    <div
      className="flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      <span
        className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
        style={{ background: 'var(--color-exam-elevated)', color: keyColor }}
      >
        {opt.key}
      </span>
      <div className="flex-1 min-w-0 text-sm leading-relaxed text-[var(--color-exam-ink-muted)]">
        <RichText content={opt.text} />
      </div>
      <div className="shrink-0 flex items-center gap-1 mt-0.5">
        {isSelected && (
          <span className="text-xs" style={{ color: isCorrect ? 'var(--color-exam-success)' : 'var(--color-exam-danger)' }}>
            {isCorrect ? '✓ your pick' : '✗ your pick'}
          </span>
        )}
        {isCorrect && !isSelected && hasAttempt && (
          <span className="text-xs text-[var(--color-exam-success)]">correct</span>
        )}
        {isCorrect && !hasAttempt && (
          <span className="text-xs text-[var(--color-exam-success)]">answer</span>
        )}
      </div>
    </div>
  );
}

// ─── Difficulty bar under each question ───────────────────────────────────────

function ClassDiffBar({ analytics }: { analytics: { correctCount: number; wrongCount: number; skippedCount: number } | undefined }) {
  if (!analytics) return null;
  const total = analytics.correctCount + analytics.wrongCount + analytics.skippedCount;
  if (total === 0) return null;
  const pctCorrect = (analytics.correctCount / total) * 100;
  const pctWrong   = (analytics.wrongCount   / total) * 100;
  const pctSkipped = (analytics.skippedCount / total) * 100;

  // "Most skipped" if skipped > 50% of class
  const mostSkipped = analytics.skippedCount / total > 0.5;

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[var(--color-exam-ink-faint)] text-xs">Class performance</span>
        {mostSkipped && (
          <span
            className="text-xs px-1.5 py-0.5 rounded-full font-medium"
            style={{
              background: 'color-mix(in srgb, var(--color-exam-gold) 12%, transparent)',
              color: 'var(--color-exam-gold)',
              border: '1px solid color-mix(in srgb, var(--color-exam-gold) 30%, transparent)',
            }}
          >
            Most skipped
          </span>
        )}
      </div>
      {/* Stacked bar */}
      <div className="h-1.5 rounded-full overflow-hidden flex" style={{ background: 'var(--color-exam-border)' }}>
        <div style={{ width: `${pctCorrect}%`, background: 'var(--color-exam-success)' }} />
        <div style={{ width: `${pctWrong}%`,   background: 'var(--color-exam-danger)'  }} />
        <div style={{ width: `${pctSkipped}%`, background: 'var(--color-exam-elevated)' }} />
      </div>
      <div className="flex gap-3 mt-1.5 text-xs text-[var(--color-exam-ink-faint)]">
        <span><span style={{ color: 'var(--color-exam-success)' }}>{analytics.correctCount}</span> correct</span>
        <span><span style={{ color: 'var(--color-exam-danger)'  }}>{analytics.wrongCount}</span> wrong</span>
        <span>{analytics.skippedCount} skipped</span>
        <span className="ml-auto">{pctCorrect.toFixed(0)}% class got it right</span>
      </div>
    </div>
  );
}

// ─── Single question ──────────────────────────────────────────────────────────

function QuestionItem({
  q,
  response,
  correctKey,
  analytics,
}: {
  q: TakingSection['questions'][number];
  response: Responses[number] | undefined;
  correctKey: string | null;
  analytics: { correctCount: number; wrongCount: number; skippedCount: number } | undefined;
}) {
  const selected = response?.selected ?? null;
  const hasAttempt = selected !== null;

  let status: Status;
  if (!hasAttempt) status = response === undefined ? 'no-attempt' : 'skipped';
  else if (response?.isCorrect === true)  status = 'correct';
  else if (response?.isCorrect === false) status = 'wrong';
  else status = 'skipped';

  // Use shared options from the group if available (handled at parent level)
  const displayOptions = q.options;

  return (
    <div
      id={`q-${q.id}`}
      className="py-4 border-b border-[var(--color-exam-border)] last:border-0 scroll-mt-6"
    >
      {/* Question header */}
      <div className="flex items-start gap-3 mb-3">
        <span
          className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
          style={{ background: 'var(--color-exam-elevated)', color: 'var(--color-exam-ink-muted)' }}
        >
          {q.number}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <StatusChip status={status} />
            {selected && correctKey && selected !== correctKey && (
              <span className="text-[var(--color-exam-ink-faint)] text-xs">
                Correct: {correctKey}
              </span>
            )}
          </div>
          <div className="text-[var(--color-exam-ink)] text-sm leading-relaxed">
            <RichText content={q.stem} />
          </div>
        </div>
      </div>

      {/* Options */}
      {displayOptions.length > 0 && (
        <div className="ml-10 space-y-2">
          {displayOptions.map((opt) => (
            <OptionRow
              key={opt.key}
              opt={opt}
              isSelected={opt.key === selected}
              isCorrect={opt.key === correctKey}
              hasAttempt={hasAttempt}
            />
          ))}
        </div>
      )}

      {/* Explanation */}
      {q.explanation && q.explanation.trim().length > 0 && (
        <div
          className="ml-10 mt-3 rounded-lg px-4 py-3"
          style={{
            background: 'color-mix(in srgb, var(--color-exam-gold) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-exam-gold) 24%, transparent)',
          }}
        >
          <div className="text-[var(--color-exam-gold)] text-xs font-medium tracking-[0.14em] uppercase mb-1.5">
            Explanation
          </div>
          <div className="text-sm leading-relaxed text-[var(--color-exam-ink-muted)]">
            <RichText content={q.explanation} />
          </div>
        </div>
      )}

      {/* Class difficulty bar */}
      <div className="ml-10 mt-1">
        <ClassDiffBar analytics={analytics} />
      </div>
    </div>
  );
}

// ─── Group header (passage / instruction) ─────────────────────────────────────

function GroupHeader({ group }: { group: TakingGroup }) {
  const [open, setOpen] = useState(group.kind === 'instruction');
  const title = group.title ?? (group.kind === 'passage' ? 'Passage' : group.kind === 'instruction' ? 'Instructions' : 'Context');

  return (
    <div
      className="rounded-lg overflow-hidden mb-3"
      style={{ background: 'var(--color-exam-elevated)', border: '1px solid var(--color-exam-border)' }}
    >
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-[var(--color-exam-gold)] text-xs font-medium tracking-wide uppercase flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
          </svg>
          {title}
        </span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="var(--color-exam-ink-faint)" strokeWidth="2"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 text-[var(--color-exam-ink-muted)] text-sm leading-relaxed border-t border-[var(--color-exam-border)]" style={{ paddingTop: '12px' }}>
          <RichText content={group.content} />
        </div>
      )}
    </div>
  );
}

// ─── Section block ────────────────────────────────────────────────────────────

function SectionBlock({
  section,
  responses,
  answerKey,
  questionAnalytics,
}: {
  section: TakingSection;
  responses: Responses;
  answerKey: AnswerKey;
  questionAnalytics: QuestionAnalytics;
}) {
  const [open, setOpen] = useState(true);

  // Build group map
  const groupMap = new Map<number, TakingGroup>(section.groups.map((g) => [g.id, g]));

  // Interleave groups + questions in display order
  type DisplayItem =
    | { kind: 'group'; group: TakingGroup }
    | { kind: 'question'; q: TakingSection['questions'][number] };

  const items: DisplayItem[] = [];
  const renderedGroups = new Set<number>();

  for (const q of section.questions) {
    if (q.groupId !== null && !renderedGroups.has(q.groupId)) {
      const g = groupMap.get(q.groupId);
      if (g) {
        items.push({ kind: 'group', group: g });
        renderedGroups.add(q.groupId);
      }
    }
    items.push({ kind: 'question', q });
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--color-exam-surface)', border: '1px solid var(--color-exam-border)' }}
    >
      {/* Section header */}
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <span
            className="text-[var(--color-exam-ink)] font-semibold text-sm"
          >
            {section.title}
          </span>
          <span className="text-[var(--color-exam-ink-faint)] text-xs">
            {section.totalQuestions} questions
          </span>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="var(--color-exam-ink-faint)" strokeWidth="2"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="px-5 border-t border-[var(--color-exam-border)]">
          {items.map((item, i) => {
            if (item.kind === 'group') {
              return (
                <div key={`g-${item.group.id}`} className="pt-4">
                  <GroupHeader group={item.group} />
                </div>
              );
            }
            return (
              <QuestionItem
                key={item.q.id}
                q={item.q}
                response={responses[item.q.id]}
                correctKey={answerKey[item.q.id] ?? null}
                analytics={questionAnalytics[item.q.id]}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Top-level component ──────────────────────────────────────────────────────

export default function QuestionReview({ sections, responses, answerKey, questionAnalytics }: Props) {
  return (
    <div>
      <h2 className="text-[var(--color-exam-ink-faint)] text-xs tracking-[0.18em] uppercase mb-4">
        Question Review
      </h2>
      <div className="space-y-4">
        {sections.map((sec) => (
          <SectionBlock
            key={sec.id}
            section={sec}
            responses={responses}
            answerKey={answerKey}
            questionAnalytics={questionAnalytics}
          />
        ))}
      </div>
    </div>
  );
}

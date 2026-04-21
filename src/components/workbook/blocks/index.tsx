'use client';

import React from 'react';
import RichText from '@/components/workbook/RichText';
import type { WorkbookBlock, McqOption } from '@/lib/workbook/types';
import { BookOpen, Lightbulb, AlertCircle, Zap, MessageCircle } from 'lucide-react';

// ─── Heading blocks ───────────────────────────────────────────────────────────

export function SectionHeading({ block }: { block: WorkbookBlock }) {
  return (
    <div id={block.anchor} className="scroll-mt-20 pt-10 pb-2 first:pt-0">
      <h2 className="wb-section-heading">
        <RichText content={block.content ?? ''} />
      </h2>
      <div className="wb-rule" />
    </div>
  );
}

export function SubsectionHeading({ block }: { block: WorkbookBlock }) {
  return (
    <div id={block.anchor} className="scroll-mt-20 pt-7 pb-1">
      <h3 className="wb-subsection-heading">
        <RichText content={block.content ?? ''} />
      </h3>
    </div>
  );
}

export function SubsubsectionHeading({ block }: { block: WorkbookBlock }) {
  return (
    <div id={block.anchor} className="scroll-mt-20 pt-5">
      <h4 className="wb-subsubsection-heading">
        <RichText content={block.content ?? ''} />
      </h4>
    </div>
  );
}

// ─── Prose ────────────────────────────────────────────────────────────────────

export function ProseBlock({ block }: { block: WorkbookBlock }) {
  return (
    <p className="wb-prose">
      <RichText content={block.content ?? ''} />
    </p>
  );
}

// ─── Math display block ───────────────────────────────────────────────────────

export function MathBlock({ block }: { block: WorkbookBlock }) {
  return (
    <div className="wb-math-display">
      <RichText content={block.content ?? ''} />
    </div>
  );
}

// ─── List block ───────────────────────────────────────────────────────────────

export function ListBlock({ block }: { block: WorkbookBlock }) {
  const items = block.items ?? [];
  const Tag = block.variant === 'ordered' ? 'ol' : 'ul';
  return (
    <Tag className={`wb-list ${block.variant === 'ordered' ? 'list-decimal' : 'list-disc'}`}>
      {items.map((item, i) => (
        <li key={i} className="wb-list-item">
          <RichText content={item} />
        </li>
      ))}
    </Tag>
  );
}

// ─── Table block ─────────────────────────────────────────────────────────────
// For the fraction/decimal/percent conversion table in chapter 1.
// We render a hardcoded clean version since the LaTeX tabular is complex.

export function TableBlock({ block: _ }: { block: WorkbookBlock }) {
  const rows = [
    ['½', '0.5', '50%',       '⅛',  '0.125', '12.5%'],
    ['⅓', '0.3̄',  '33.3̄%',    '⅜',  '0.375', '37.5%'],
    ['⅔', '0.6̄',  '66.6̄%',    '⅝',  '0.625', '62.5%'],
    ['¼', '0.25', '25%',      '⅞',  '0.875', '87.5%'],
    ['¾', '0.75', '75%',      '⅙',  '0.16̄',  '16.6̄%'],
    ['⅕', '0.2',  '20%',      '⅚',  '0.83̄',  '83.3̄%'],
    ['⅖', '0.4',  '40%',      '⅑',  '0.1̄',   '11.1̄%'],
    ['⅗', '0.6',  '60%',      '1/10','0.1',  '10%'],
    ['⅘', '0.8',  '80%',      '1/12','0.083̄','8.3̄%'],
  ];

  return (
    <div className="wb-table-wrap">
      <p className="wb-table-caption">Common Fraction–Decimal–Percentage Conversions</p>
      <div className="overflow-x-auto">
        <table className="wb-table">
          <thead>
            <tr>
              <th>Fraction</th><th>Decimal</th><th>Percent</th>
              <th>Fraction</th><th>Decimal</th><th>Percent</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className={j === 0 || j === 3 ? 'font-semibold' : ''}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Box cards ───────────────────────────────────────────────────────────────

interface BoxCardProps {
  block: WorkbookBlock;
  bg: string;
  border: string;
  borderLeft?: string;
  icon?: React.ReactNode;
  label?: string;
  labelColor?: string;
}

function BoxCard({ block, bg, border, borderLeft, icon, label, labelColor }: BoxCardProps) {
  return (
    <div
      className="wb-box"
      style={{
        background: bg,
        border,
        borderLeft: borderLeft ?? undefined,
        borderRadius: '10px',
      }}
    >
      {label && (
        <div className="wb-box-label" style={{ color: labelColor ?? 'inherit' }}>
          {icon}
          <span>{label}</span>
        </div>
      )}
      <div className="wb-box-content">
        <RichText content={block.content ?? ''} />
      </div>
    </div>
  );
}

export function DefinitionCard({ block }: { block: WorkbookBlock }) {
  return (
    <BoxCard
      block={block}
      bg="rgba(118,15,19,0.04)"
      border="1px solid rgba(118,15,19,0.15)"
      borderLeft="3px solid #760F13"
      icon={<BookOpen size={13} />}
      label="Definition"
      labelColor="#760F13"
    />
  );
}

export function NoteCard({ block }: { block: WorkbookBlock }) {
  return (
    <BoxCard
      block={block}
      bg="rgba(212,176,148,0.12)"
      border="1px solid rgba(212,176,148,0.4)"
      borderLeft="3px solid #D4B094"
      icon={<Lightbulb size={13} />}
      label="Exam Note"
      labelColor="#9A7060"
    />
  );
}

export function RuleCard({ block }: { block: WorkbookBlock }) {
  return (
    <BoxCard
      block={block}
      bg="rgba(26,5,7,0.04)"
      border="1px solid rgba(26,5,7,0.18)"
      icon={<AlertCircle size={13} />}
      label="Rule"
      labelColor="#3D1A10"
    />
  );
}

export function PassageCard({ block }: { block: WorkbookBlock }) {
  return (
    <div className="wb-passage">
      <RichText content={block.content ?? ''} />
    </div>
  );
}

export function UsageNoteCard({ block }: { block: WorkbookBlock }) {
  return (
    <BoxCard
      block={block}
      bg="rgba(212,176,148,0.07)"
      border="1px solid rgba(212,176,148,0.35)"
      borderLeft="3px solid rgba(212,176,148,0.6)"
      labelColor="#9A7060"
    />
  );
}

export function ChallengeCard({ block }: { block: WorkbookBlock }) {
  return (
    <BoxCard
      block={block}
      bg="rgba(180,83,9,0.05)"
      border="1px solid rgba(180,83,9,0.2)"
      icon={<Zap size={13} />}
      label="Challenge"
      labelColor="#B45309"
    />
  );
}

// ─── MCQ Block ────────────────────────────────────────────────────────────────

const WA_LINK = process.env.NEXT_PUBLIC_WORKBOOK_WA_LINK ?? '#';

interface MCQState {
  selected: string | null;
  revealed: boolean;
}

interface McqBlockProps {
  block: WorkbookBlock;
  chapterSlug: string;
}

export function McqBlock({ block, chapterSlug }: McqBlockProps) {
  const [state, setState] = React.useState<MCQState>({ selected: null, revealed: false });
  const options: McqOption[] = block.options ?? [];

  const isSolved   = block.questionType === 'solved';
  const hasAnswer  = !!block.correctLabel;

  function handleSelect(label: string) {
    if (state.revealed) return;
    setState({ selected: label, revealed: true });

    // Fire-and-forget — record attempt
    fetch('/api/workbook/mcq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chapterSlug,
        questionId: block.id,
        selectedOption: label,
        isCorrect: label === block.correctLabel,
      }),
    }).catch(() => {});
  }

  function optionStyle(label: string) {
    if (!state.revealed || state.selected !== label) return 'wb-mcq-option';
    if (hasAnswer) {
      return label === block.correctLabel ? 'wb-mcq-option wb-mcq-correct' : 'wb-mcq-option wb-mcq-wrong';
    }
    return 'wb-mcq-option wb-mcq-selected';
  }

  function optionCorrectHint(label: string) {
    if (!state.revealed || !hasAnswer) return null;
    if (label === block.correctLabel) return ' ✓';
    if (label === state.selected && label !== block.correctLabel) return ' ✗';
    return null;
  }

  const qTypeLabel =
    block.questionType === 'solved'    ? 'Solved Example'  :
    block.questionType === 'challenge' ? 'Challenge'       :
    'Practice';

  return (
    <div className="wb-mcq">
      <div className="wb-mcq-header">
        <span className={`wb-mcq-tag wb-mcq-tag--${block.questionType ?? 'practice'}`}>
          {qTypeLabel}
        </span>
      </div>

      <p className="wb-mcq-question">
        <RichText content={block.question ?? ''} />
      </p>

      <div className="wb-mcq-options">
        {options.map(opt => (
          <button
            key={opt.label}
            onClick={() => handleSelect(opt.label)}
            className={optionStyle(opt.label)}
            disabled={state.revealed}
          >
            <span className="wb-mcq-opt-label">{opt.label}</span>
            <span className="wb-mcq-opt-text">
              <RichText content={opt.text} inline />
            </span>
            {optionCorrectHint(opt.label) && (
              <span className="wb-mcq-hint">{optionCorrectHint(opt.label)}</span>
            )}
          </button>
        ))}
      </div>

      {state.revealed && (
        <div className="wb-mcq-solution-banner">
          <MessageCircle size={15} className="shrink-0 mt-0.5" />
          <div>
            <p className="wb-mcq-solution-text">
              {isSolved && block.solutionHint
                ? <RichText content={block.solutionHint} />
                : 'Detailed step-by-step solution available in our WhatsApp group.'}
            </p>
            <a
              href={WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="wb-mcq-wa-link"
            >
              Join Beyond the Horizons WhatsApp Group →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

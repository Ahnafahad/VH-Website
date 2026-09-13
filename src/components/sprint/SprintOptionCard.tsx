'use client';

import RichText from '@/components/workbook/RichText';

interface SprintOptionCardProps {
  optionKey: string;
  text: string;
  selected: boolean;
  /** Set once the question has been answered/skipped — drives reveal colors. */
  revealed: boolean;
  isCorrectKey: boolean;
  onSelect: () => void;
}

export default function SprintOptionCard({
  optionKey, text, selected, revealed, isCorrectKey, onSelect,
}: SprintOptionCardProps) {
  let stateClasses = 'bg-exam-elevated border-exam-border text-exam-ink-muted hover:border-exam-gold/40 hover:text-exam-ink cursor-pointer';
  if (revealed) {
    if (isCorrectKey) {
      stateClasses = 'bg-emerald-500/15 border-emerald-500 text-exam-ink';
    } else if (selected) {
      stateClasses = 'bg-red-500/15 border-red-500 text-exam-ink';
    } else {
      stateClasses = 'bg-exam-elevated border-exam-border text-exam-ink-faint opacity-60';
    }
  } else if (selected) {
    stateClasses = 'bg-exam-maroon/15 border-exam-maroon-bright text-exam-ink';
  }

  return (
    <button
      onClick={onSelect}
      disabled={revealed}
      className={[
        'w-full text-left flex items-start gap-4 p-4 rounded-xl border transition-colors duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-exam-gold/50',
        stateClasses,
        revealed ? 'cursor-default' : '',
      ].join(' ')}
      aria-pressed={selected}
    >
      <span
        className={[
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors duration-150',
          revealed && isCorrectKey ? 'bg-emerald-500 text-white'
          : revealed && selected ? 'bg-red-500 text-white'
          : selected ? 'bg-exam-maroon-bright text-exam-ink'
          : 'bg-exam-surface border border-exam-gold/20 text-exam-ink-faint',
        ].join(' ')}
      >
        {optionKey}
      </span>
      <span className="flex-1 text-sm leading-relaxed pt-0.5">
        <RichText content={text} />
      </span>
    </button>
  );
}

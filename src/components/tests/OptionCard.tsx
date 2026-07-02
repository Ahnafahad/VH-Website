'use client';

import { motion, Variants } from 'framer-motion';
import RichText from '@/components/workbook/RichText';

interface OptionCardProps {
  optionKey: string;
  text: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

const cardVariants: Variants = {
  idle: { scale: 1 },
  tap: { scale: 0.975 },
};

export default function OptionCard({ optionKey, text, selected, onSelect, disabled }: OptionCardProps) {
  return (
    <motion.button
      onClick={onSelect}
      disabled={disabled}
      variants={cardVariants}
      initial="idle"
      whileTap="tap"
      transition={{ type: 'spring' as const, stiffness: 500, damping: 28 }}
      className={[
        'w-full text-left flex items-start gap-4 p-4 rounded-xl border transition-colors duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-exam-gold/50',
        selected
          ? 'bg-exam-maroon/20 border-exam-maroon-bright text-exam-ink'
          : 'bg-exam-elevated border-exam-border text-exam-ink-muted hover:border-exam-gold/40 hover:text-exam-ink',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
      aria-pressed={selected}
    >
      {/* Key bubble */}
      <span
        className={[
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
          selected
            ? 'bg-exam-maroon-bright text-exam-ink'
            : 'bg-exam-surface border border-exam-border text-exam-ink-faint',
        ].join(' ')}
      >
        {optionKey}
      </span>
      {/* Text */}
      <span className="flex-1 text-sm leading-relaxed pt-0.5">
        <RichText content={text} />
      </span>
    </motion.button>
  );
}

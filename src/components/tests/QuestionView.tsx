'use client';

import { useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Bookmark, BookmarkCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import RichText from '@/components/workbook/RichText';
import OptionCard from '@/components/tests/OptionCard';
import type { TakingQuestion, TakingGroup } from '@/lib/tests/types';

interface QuestionViewProps {
  question: TakingQuestion;
  group: TakingGroup | null;
  selectedKey: string | null;
  flagged: boolean;
  onSelect: (key: string | null) => void;
  onFlag: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  questionNumber: number;   // display number
  totalQuestions: number;
  disabled?: boolean;
}

const slideVariants: Variants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 40 : -40,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -40 : 40,
    opacity: 0,
    transition: { duration: 0.15 },
  }),
};

export default function QuestionView({
  question,
  group,
  selectedKey,
  flagged,
  onSelect,
  onFlag,
  onPrev,
  onNext,
  questionNumber,
  totalQuestions,
  disabled,
}: QuestionViewProps) {
  const [passageExpanded, setPassageExpanded] = useState(true);

  const hasGroup = group !== null;
  const isSharedOptions = group?.kind === 'shared_options';

  return (
    <div className="flex flex-col h-full">
      {/* Question header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-exam-border flex-shrink-0">
        <span className="text-exam-ink-faint text-xs font-medium uppercase tracking-widest">
          Question {questionNumber} of {totalQuestions}
        </span>
        <motion.button
          onClick={onFlag}
          disabled={disabled}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring' as const, stiffness: 400, damping: 20 }}
          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
            flagged
              ? 'text-exam-gold bg-exam-gold/10 border border-exam-gold/30'
              : 'text-exam-ink-faint hover:text-exam-gold border border-transparent hover:border-exam-gold/20'
          }`}
        >
          {flagged ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
          {flagged ? 'Flagged' : 'Flag'}
        </motion.button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Group content (passage / instruction / scenario) */}
        <AnimatePresence initial={false}>
          {hasGroup && !isSharedOptions && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="border-b border-exam-border"
            >
              <button
                onClick={() => setPassageExpanded(e => !e)}
                className="w-full flex items-center justify-between px-4 pt-4 pb-2 text-left"
              >
                <span className="text-exam-gold text-xs font-bold uppercase tracking-widest">
                  {group?.kind === 'passage' ? 'Passage' : group?.kind === 'instruction' ? 'Instructions' : 'Scenario'}
                  {group?.title ? ` — ${group.title}` : ''}
                </span>
                <span className="text-exam-ink-faint text-xs">
                  {passageExpanded ? 'Collapse ▴' : 'Expand ▾'}
                </span>
              </button>
              <AnimatePresence initial={false}>
                {passageExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden px-4 pb-4"
                  >
                    <div className="bg-exam-elevated rounded-xl p-4 border border-exam-border">
                      <p className="text-exam-ink-muted text-sm leading-relaxed">
                        <RichText content={group?.content ?? ''} />
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Shared options group */}
        {hasGroup && isSharedOptions && group?.sharedOptions && (
          <div className="px-4 pt-4 pb-2 border-b border-exam-border">
            <p className="text-exam-gold text-xs font-bold uppercase tracking-widest mb-3">
              {group?.content || 'Shared Options'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {group.sharedOptions.map(opt => (
                <div key={opt.key} className="bg-exam-elevated rounded-lg px-3 py-2 border border-exam-border text-sm text-exam-ink-muted">
                  <span className="font-bold text-exam-ink-faint mr-2">{opt.key}.</span>
                  <RichText content={opt.text} inline />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stem + image + options */}
        <div className="px-4 py-5 space-y-5">
          {/* Stem */}
          <div className="text-exam-ink text-base leading-relaxed">
            <RichText content={question.stem} />
          </div>

          {/* Image */}
          {question.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={question.imageUrl}
              alt={`Question ${question.number} illustration`}
              className="max-w-full rounded-lg border border-exam-border"
            />
          )}

          {/* Options */}
          <div className="space-y-2.5">
            {question.options.map(opt => (
              <OptionCard
                key={opt.key}
                optionKey={opt.key}
                text={opt.text}
                selected={selectedKey === opt.key}
                onSelect={() => onSelect(selectedKey === opt.key ? null : opt.key)}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Prev / Next footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-exam-border flex-shrink-0">
        <motion.button
          onClick={onPrev ?? undefined}
          disabled={!onPrev || disabled}
          whileHover={onPrev ? { x: -2 } : {}}
          whileTap={onPrev ? { scale: 0.95 } : {}}
          transition={{ type: 'spring' as const, stiffness: 400, damping: 22 }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-exam-border text-exam-ink-muted
            hover:text-exam-ink hover:border-exam-ink/30 text-sm font-medium transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </motion.button>

        <span className="text-exam-ink-faint text-xs tabular-nums">{questionNumber}/{totalQuestions}</span>

        <motion.button
          onClick={onNext ?? undefined}
          disabled={!onNext || disabled}
          whileHover={onNext ? { x: 2 } : {}}
          whileTap={onNext ? { scale: 0.95 } : {}}
          transition={{ type: 'spring' as const, stiffness: 400, damping: 22 }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-exam-elevated border border-exam-border
            text-exam-ink-muted hover:text-exam-ink hover:border-exam-ink/30 text-sm font-medium transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </motion.button>
      </div>
    </div>
  );
}

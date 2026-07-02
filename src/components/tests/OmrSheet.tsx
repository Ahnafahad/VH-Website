'use client';

import { motion, Variants } from 'framer-motion';
import type { TakingSection } from '@/lib/tests/types';

interface OmrSheetProps {
  sections: TakingSection[];
  answers: Record<number, string | null>;
  onAnswer: (questionId: number, key: string | null) => void;
  disabled?: boolean;
}

const bubbleVariants: Variants = {
  idle: { scale: 1 },
  tap: { scale: 0.85 },
};

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'];

function Bubble({
  label,
  selected,
  onClick,
  disabled,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      variants={bubbleVariants}
      initial="idle"
      whileTap="tap"
      transition={{ type: 'spring' as const, stiffness: 500, damping: 22 }}
      aria-pressed={selected}
      aria-label={`Option ${label}`}
      className={[
        'w-9 h-9 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors duration-100',
        selected
          ? 'bg-exam-maroon border-exam-maroon text-white'
          : 'bg-transparent border-[#C8A24B]/40 text-[#7C6E60] hover:border-exam-maroon/60',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      {label}
    </motion.button>
  );
}

export default function OmrSheet({ sections, answers, onAnswer, disabled }: OmrSheetProps) {
  return (
    <div className="min-h-screen bg-exam-base p-4 sm:p-6 pb-24">
      {/* Paper card */}
      <div className="max-w-2xl mx-auto bg-[#FAF5EF] rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-exam-maroon px-6 py-4">
          <h2 className="text-white font-serif text-lg font-semibold tracking-wide">Answer Sheet</h2>
          <p className="text-white/70 text-xs mt-0.5">Select your answer for each question. Tap again to clear.</p>
        </div>

        <div className="divide-y divide-[#E8DDD0]">
          {sections.map((section) => (
            <div key={section.id} className="px-6 py-5">
              {/* Section header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-[#C8A24B]/30" />
                <span className="text-[#760F13] text-xs font-bold uppercase tracking-widest px-2">
                  {section.title}
                </span>
                <div className="h-px flex-1 bg-[#C8A24B]/30" />
              </div>

              {/* Question rows */}
              <div className="space-y-2">
                {/* Header row */}
                <div className="grid items-center gap-2 mb-3" style={{ gridTemplateColumns: '3rem 1fr' }}>
                  <span className="text-[#7C6E60] text-xs font-medium">#</span>
                  <div className="flex gap-3">
                    {OPTION_LABELS.slice(0, Math.max(...section.questions.map(q => q.options.length), 4)).map(l => (
                      <span key={l} className="w-9 text-center text-[#7C6E60] text-xs font-bold">{l}</span>
                    ))}
                  </div>
                </div>

                {section.questions.map((q) => {
                  const selected = answers[q.id] ?? null;
                  const numOptions = q.options.length;
                  return (
                    <div
                      key={q.id}
                      className="grid items-center gap-2 py-1.5"
                      style={{ gridTemplateColumns: '3rem 1fr' }}
                    >
                      <span className="text-[#3A2F29] text-sm font-semibold tabular-nums">{q.number}</span>
                      <div className="flex gap-3">
                        {OPTION_LABELS.slice(0, numOptions).map((label) => (
                          <Bubble
                            key={label}
                            label={label}
                            selected={selected === label}
                            onClick={() => onAnswer(q.id, selected === label ? null : label)}
                            disabled={disabled}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer watermark */}
        <div className="px-6 py-3 bg-[#F0E8DC] border-t border-[#DDD0C0]">
          <p className="text-[#B7A99A] text-xs text-center">
            VH · Official Answer Sheet · Do not close this tab before submitting
          </p>
        </div>
      </div>
    </div>
  );
}

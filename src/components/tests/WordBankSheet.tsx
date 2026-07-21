'use client';

import { motion, Variants } from 'framer-motion';
import RichText from '@/components/workbook/RichText';
import type { TakingSection } from '@/lib/tests/types';

interface WordBankSheetProps {
  sections: TakingSection[];
  answers: Record<number, string | null>;
  onAnswer: (questionId: number, key: string | null) => void;
  disabled?: boolean;
}

const bubbleVariants: Variants = {
  idle: { scale: 1 },
  tap: { scale: 0.85 },
};

function Bubble({
  label,
  selected,
  usedElsewhere,
  onClick,
  disabled,
}: {
  label: string;
  selected: boolean;
  usedElsewhere: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  const isDisabled = disabled || usedElsewhere;
  return (
    <motion.button
      onClick={onClick}
      disabled={isDisabled}
      variants={bubbleVariants}
      initial="idle"
      whileTap="tap"
      transition={{ type: 'spring' as const, stiffness: 500, damping: 22 }}
      aria-pressed={selected}
      aria-label={`Option ${label}`}
      className={[
        'w-8 h-8 rounded-full border-2 flex items-center justify-center text-[11px] font-bold transition-[background-color,border-color,filter,opacity] duration-100',
        selected
          ? 'bg-exam-maroon border-exam-maroon text-white'
          : 'bg-transparent border-[#C8A24B]/40 text-[#7C6E60] hover:border-exam-maroon/60',
        usedElsewhere ? 'opacity-40 blur-[0.5px] cursor-not-allowed' : (disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'),
      ].join(' ')}
    >
      {label}
    </motion.button>
  );
}

export default function WordBankSheet({ sections, answers, onAnswer, disabled }: WordBankSheetProps) {
  return (
    <div className="min-h-screen bg-exam-base p-4 sm:p-6 pb-24">
      <div className="max-w-2xl mx-auto bg-[#FAF5EF] rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-exam-maroon px-6 py-4">
          <h2 className="text-white font-serif text-lg font-semibold tracking-wide">Word Bank Answer Sheet</h2>
          <p className="text-white/70 text-xs mt-0.5">Pick a letter for each sentence. Tap again to clear.</p>
        </div>

        <div className="divide-y divide-[#E8DDD0]">
          {sections.map((section) => {
            const group = section.groups[0] ?? null;
            const bank = group?.sharedOptions ?? [];
            // keys already used by another question in this section (pool exclusion)
            const usedByQuestion: Record<number, string | null> = {};
            for (const q of section.questions) usedByQuestion[q.id] = answers[q.id] ?? null;

            return (
              <div key={section.id} className="px-6 py-5">
                {/* Section header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1 bg-[#C8A24B]/30" />
                  <span className="text-[#760F13] text-xs font-bold uppercase tracking-widest px-2">
                    {section.title}
                  </span>
                  <div className="h-px flex-1 bg-[#C8A24B]/30" />
                </div>

                {/* Word bank legend */}
                {bank.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-4 bg-[#F0E8DC] rounded-lg p-3 border border-[#DDD0C0]">
                    {bank.map(opt => (
                      <div key={opt.key} className="text-xs text-[#5A4C40]">
                        <span className="font-bold text-[#7C6E60] mr-1">{opt.key}.</span>
                        <RichText content={opt.text} inline />
                      </div>
                    ))}
                  </div>
                )}

                {/* Question rows */}
                <div className="space-y-2">
                  {section.questions.map((q) => {
                    const selected = answers[q.id] ?? null;
                    return (
                      <div key={q.id} className="grid items-center gap-2 py-1.5" style={{ gridTemplateColumns: '3rem 1fr' }}>
                        <span className="text-[#3A2F29] text-sm font-semibold tabular-nums">{q.number}</span>
                        <div className="flex flex-wrap gap-2">
                          {bank.map((opt) => {
                            const usedElsewhere = opt.key !== selected && Object.entries(usedByQuestion)
                              .some(([qid, key]) => Number(qid) !== q.id && key === opt.key);
                            return (
                              <Bubble
                                key={opt.key}
                                label={opt.key}
                                selected={selected === opt.key}
                                usedElsewhere={usedElsewhere}
                                onClick={() => onAnswer(q.id, selected === opt.key ? null : opt.key)}
                                disabled={disabled}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-3 bg-[#F0E8DC] border-t border-[#DDD0C0]">
          <p className="text-[#B7A99A] text-xs text-center">
            VH · Official Answer Sheet · Do not close this tab before submitting
          </p>
        </div>
      </div>
    </div>
  );
}

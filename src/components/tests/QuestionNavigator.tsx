'use client';

import { useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { ChevronDown, ChevronUp, Send } from 'lucide-react';
import { BorderBeam } from '@/components/ui/border-beam';
import type { TakingSection } from '@/lib/tests/types';

export type QState = 'blank' | 'answered' | 'flagged' | 'current';

export interface QuestionNav {
  questionId: number;
  globalIndex: number; // 0-based across all sections
  number: number;
  sectionIndex: number;
}

interface QuestionNavigatorProps {
  sections: TakingSection[];
  currentGlobalIdx: number;
  getState: (questionId: number) => QState;
  onJump: (globalIdx: number) => void;
  onSubmit: () => void;
  /** mobile = render as bottom drawer toggle */
  mobile?: boolean;
}

const drawerVariants: Variants = {
  hidden: { y: '100%', opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 300, damping: 32 } },
  exit: { y: '100%', opacity: 0, transition: { duration: 0.2 } },
};

const stateClass: Record<QState, string> = {
  blank: 'bg-exam-q-blank border-exam-border text-exam-ink-faint',
  answered: 'bg-exam-q-answered border-exam-q-answered text-white',
  flagged: 'bg-exam-q-flagged border-exam-q-flagged text-white',
  current: 'bg-exam-q-current border-exam-q-current text-white ring-2 ring-exam-gold/50 ring-offset-2 ring-offset-exam-surface',
};

function ChipGrid({ sections, currentGlobalIdx, getState, onJump }: Omit<QuestionNavigatorProps, 'onSubmit' | 'mobile'>) {
  let gIdx = 0;
  return (
    <div className="space-y-4">
      {sections.map((section, si) => {
        const sectionStart = gIdx;
        gIdx += section.questions.length;
        return (
          <div key={section.id}>
            <p className="text-exam-ink-faint text-[10px] uppercase tracking-[0.2em] font-medium mb-2 px-1">
              {section.title}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {section.questions.map((q, qi) => {
                const idx = sectionStart + qi;
                const state: QState = idx === currentGlobalIdx ? 'current' : getState(q.id);
                return (
                  <motion.button
                    key={q.id}
                    onClick={() => onJump(idx)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.92 }}
                    transition={{ type: 'spring' as const, stiffness: 500, damping: 24 }}
                    className={`w-8 h-8 rounded-md border text-xs font-semibold tabular-nums transition-colors ${stateClass[state]}`}
                    aria-label={`Question ${q.number}`}
                  >
                    {q.number}
                  </motion.button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LegendRow() {
  const items: [QState, string][] = [
    ['blank', 'Not attempted'],
    ['answered', 'Answered'],
    ['flagged', 'Flagged'],
    ['current', 'Current'],
  ];
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-4 pt-4 border-t border-exam-border">
      {items.map(([state, label]) => (
        <div key={state} className="flex items-center gap-1.5">
          <span className={`w-3.5 h-3.5 rounded border text-[8px] flex items-center justify-center font-bold ${stateClass[state]}`} />
          <span className="text-exam-ink-faint text-xs">{label}</span>
        </div>
      ))}
    </div>
  );
}

export default function QuestionNavigator(props: QuestionNavigatorProps) {
  const { sections, currentGlobalIdx, getState, onJump, onSubmit, mobile } = props;
  const [drawerOpen, setDrawerOpen] = useState(false);

  const totalQ = sections.reduce((s, sec) => s + sec.questions.length, 0);
  const answeredCount = sections.flatMap(s => s.questions).filter(q => getState(q.id) === 'answered' || getState(q.id) === 'flagged').length;

  if (mobile) {
    return (
      <>
        {/* Bottom bar toggle */}
        <div
          className="fixed bottom-0 left-0 right-0 z-30 bg-exam-surface border-t border-exam-border"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div
            className="absolute inset-x-0 top-0 h-px pointer-events-none"
            style={{ background: 'linear-gradient(90deg, transparent, var(--color-exam-gold) 50%, transparent)', opacity: 0.35 }}
          />
          <div className="flex items-center justify-between px-4 py-2">
            <button
              onClick={() => setDrawerOpen(o => !o)}
              className="flex items-center gap-2 text-exam-ink-muted text-sm"
            >
              {drawerOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              <span className="tabular-nums">{answeredCount}/{totalQ} answered</span>
            </button>
            <motion.button
              onClick={onSubmit}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring' as const, stiffness: 400, damping: 20 }}
              className="flex items-center gap-2 px-4 py-2 bg-exam-maroon hover:bg-exam-maroon-bright text-exam-ink text-sm font-medium rounded-xl transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              Submit
            </motion.button>
          </div>
        </div>

        {/* Drawer */}
        <AnimatePresence>
          {drawerOpen && (
            <motion.div
              variants={drawerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed bottom-[calc(52px_+_env(safe-area-inset-bottom))] left-0 right-0 z-20 bg-exam-surface border-t border-exam-border
                max-h-[60vh] overflow-y-auto p-4"
            >
              <ChipGrid {...props} />
              <LegendRow />
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  // Desktop rail
  return (
    <aside className="relative w-64 flex-shrink-0 bg-exam-surface border-l border-exam-border flex flex-col">
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, var(--color-exam-gold) 50%, transparent)', opacity: 0.35 }}
      />
      <div className="flex-1 overflow-y-auto p-4">
        <p className="font-heading text-exam-ink text-base font-medium mb-4">
          Question Navigator
          <span className="ml-2 text-exam-ink-faint font-sans font-normal text-xs tabular-nums">{answeredCount}/{totalQ}</span>
        </p>
        <ChipGrid {...props} />
        <LegendRow />
      </div>
      <div className="p-4 border-t border-exam-border">
        <motion.button
          onClick={onSubmit}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring' as const, stiffness: 400, damping: 20 }}
          className="relative w-full flex items-center justify-center gap-2 py-3 overflow-hidden bg-exam-maroon hover:bg-exam-maroon-bright
            text-exam-ink font-medium text-sm rounded-xl transition-colors"
        >
          <BorderBeam size={60} duration={7} colorFrom="var(--color-exam-gold)" colorTo="var(--color-exam-maroon-bright)" />
          <Send className="relative w-4 h-4" />
          <span className="relative">Submit Test</span>
        </motion.button>
      </div>
    </aside>
  );
}

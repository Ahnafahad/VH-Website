'use client';

import { motion, Variants } from 'framer-motion';
import { AlertTriangle, Eye, RotateCcw, Ban, CheckCircle } from 'lucide-react';
import type { TestMode } from '@/lib/tests/types';

interface RulesScreenProps {
  testTitle: string;
  mode: TestMode;
  onAcknowledge: () => void;
  isLoading?: boolean;
}

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 260, damping: 24, staggerChildren: 0.08 },
  },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 280, damping: 26 } },
};

const rules = [
  {
    icon: Eye,
    color: 'text-exam-gold',
    title: 'First offence — Warning',
    body: 'Leaving or switching tabs triggers a warning. You will see a modal before you can continue.',
  },
  {
    icon: RotateCcw,
    color: 'text-exam-warning',
    title: 'Second offence — Progress Reset',
    body: 'All your saved answers are permanently wiped. The timer keeps running without pause.',
  },
  {
    icon: Ban,
    color: 'text-exam-danger',
    title: 'Third offence — Banned',
    body: 'You are permanently banned from this test. Contact an admin to appeal.',
  },
];

export default function RulesScreen({ testTitle, mode, onAcknowledge, isLoading }: RulesScreenProps) {
  return (
    <div className="min-h-screen bg-exam-base flex items-center justify-center p-4">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-lg"
      >
        {/* Header seal */}
        <motion.div variants={itemVariants} className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border-2 border-exam-gold mb-4"
            style={{ boxShadow: 'var(--color-exam-glow-gold) 0 0 24px 0' }}>
            <AlertTriangle className="w-8 h-8 text-exam-gold" />
          </div>
          <h1 className="text-exam-ink font-serif text-2xl font-semibold tracking-wide mb-1">
            Examination Rules
          </h1>
          <p className="text-exam-ink-muted text-sm">{testTitle}</p>
          <span className="inline-block mt-2 px-3 py-0.5 rounded-full text-xs font-medium border border-exam-border text-exam-ink-faint uppercase tracking-widest">
            {mode === 'online' ? 'Online Exam' : 'Offline Answer Entry'}
          </span>
        </motion.div>

        {/* Rules card */}
        <motion.div
          variants={itemVariants}
          className="bg-exam-surface border border-exam-border rounded-2xl p-6 mb-6 space-y-5"
        >
          {mode === 'online' ? (
            <>
              <p className="text-exam-ink-muted text-sm leading-relaxed">
                This is a proctored online exam. <strong className="text-exam-ink">Tab-switching and window-blur are monitored in real time</strong> by our anti-cheat system.
              </p>
              <div className="space-y-4">
                {rules.map((rule, i) => {
                  const Icon = rule.icon;
                  return (
                    <div key={i} className="flex gap-4">
                      <div className="mt-0.5 flex-shrink-0">
                        <Icon className={`w-5 h-5 ${rule.color}`} />
                      </div>
                      <div>
                        <p className="text-exam-ink text-sm font-medium">{rule.title}</p>
                        <p className="text-exam-ink-muted text-xs leading-relaxed mt-0.5">{rule.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="pt-2 border-t border-exam-border">
                <p className="text-exam-ink-faint text-xs leading-relaxed">
                  The timer starts from when you acknowledged these rules and cannot be paused.
                  Ensure a stable internet connection before proceeding.
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="text-exam-ink-muted text-sm leading-relaxed">
                You are entering answers for a <strong className="text-exam-ink">paper-based exam</strong> you have already sat.
                Fill in your responses using the OMR-style sheet on the next screen.
              </p>
              <div className="flex gap-4">
                <div className="mt-0.5 flex-shrink-0">
                  <CheckCircle className="w-5 h-5 text-exam-success" />
                </div>
                <div>
                  <p className="text-exam-ink text-sm font-medium">Answer entry window</p>
                  <p className="text-exam-ink-muted text-xs leading-relaxed mt-0.5">
                    You have until the window closes to submit your answers. Each bubble you tap is saved
                    instantly. Submit when done — you cannot change answers after submission.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-exam-border">
                <p className="text-exam-ink-faint text-xs leading-relaxed">
                  Anti-cheat violation reporting does <strong>not</strong> apply to offline answer entry.
                  You may freely switch tabs.
                </p>
              </div>
            </>
          )}
        </motion.div>

        {/* Acknowledge button */}
        <motion.div variants={itemVariants}>
          <motion.button
            onClick={onAcknowledge}
            disabled={isLoading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring' as const, stiffness: 400, damping: 20 }}
            className="w-full py-4 rounded-xl bg-exam-maroon text-exam-ink font-semibold text-sm tracking-wide
              hover:bg-exam-maroon-bright disabled:opacity-50 disabled:cursor-not-allowed transition-colors
              border border-exam-maroon-bright/30"
          >
            {isLoading ? 'Starting…' : 'I understand — begin the test'}
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}

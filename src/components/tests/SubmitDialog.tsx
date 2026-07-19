'use client';

import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Send, X } from 'lucide-react';

interface SubmitDialogProps {
  open: boolean;
  answered: number;
  flagged: number;
  blank: number;
  total: number;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};
const panelVariants: Variants = {
  hidden: { opacity: 0, scale: 0.92, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 320, damping: 28 } },
  exit: { opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.15 } },
};

export default function SubmitDialog({ open, answered, flagged, blank, total, onConfirm, onCancel, isLoading }: SubmitDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        >
          <motion.div
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full max-w-sm bg-exam-surface border border-exam-border rounded-2xl p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <h2 className="font-heading text-exam-ink font-medium text-xl">Submit Test?</h2>
              <button onClick={onCancel} className="text-exam-ink-faint hover:text-exam-ink transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-exam-ink-muted text-sm mb-5">
              Review your progress before locking in your answers.
            </p>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-exam-elevated rounded-xl p-3 text-center border border-exam-border">
                <p className="text-exam-success text-xl font-bold tabular-nums">{answered}</p>
                <p className="text-exam-ink-faint text-xs mt-0.5">Answered</p>
              </div>
              <div className="bg-exam-elevated rounded-xl p-3 text-center border border-exam-border">
                <p className="text-exam-gold text-xl font-bold tabular-nums">{flagged}</p>
                <p className="text-exam-ink-faint text-xs mt-0.5">Flagged</p>
              </div>
              <div className="bg-exam-elevated rounded-xl p-3 text-center border border-exam-border">
                <p className="text-exam-ink-muted text-xl font-bold tabular-nums">{blank}</p>
                <p className="text-exam-ink-faint text-xs mt-0.5">Blank</p>
              </div>
            </div>

            {blank > 0 && (
              <p className="text-exam-warning text-xs mb-4 bg-exam-warning/5 border border-exam-warning/20 rounded-lg px-3 py-2">
                {blank} question{blank !== 1 ? 's' : ''} left blank. Unanswered questions are not penalised, but you cannot change answers after submission.
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={onCancel}
                disabled={isLoading}
                className="flex-1 py-3 rounded-xl border border-exam-border text-exam-ink-muted hover:text-exam-ink
                  hover:border-exam-ink/30 text-sm font-medium transition-colors disabled:opacity-50"
              >
                Go back
              </button>
              <motion.button
                onClick={onConfirm}
                disabled={isLoading}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring' as const, stiffness: 400, damping: 22 }}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-exam-maroon
                  hover:bg-exam-maroon-bright text-exam-ink font-semibold text-sm transition-colors disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {isLoading ? 'Submitting…' : `Submit (${total} Q)`}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

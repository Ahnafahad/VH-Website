'use client';

import { motion, AnimatePresence, Variants } from 'framer-motion';
import { AlertTriangle, RotateCcw, Ban } from 'lucide-react';
import type { ViolationAction } from '@/lib/tests/types';

interface ViolationModalProps {
  action: ViolationAction | null;
  tabLeaveCount: number;
  onDismiss: () => void;   // only valid for 'warning' / 'reset'
}

const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};
const panelVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 320, damping: 28 } },
  exit: { opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.15 } },
};

export default function ViolationModal({ action, tabLeaveCount, onDismiss }: ViolationModalProps) {
  const isVisible = action !== null;

  return (
    <AnimatePresence>
      {isVisible && (
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
            className="w-full max-w-sm bg-exam-surface border border-exam-border rounded-2xl p-6 text-center"
            style={action === 'ban' ? { borderColor: 'var(--color-exam-danger)' } : undefined}
          >
            {action === 'warning' && (
              <>
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-exam-warning/10 border border-exam-warning/30 mb-4">
                  <AlertTriangle className="w-7 h-7 text-exam-warning" />
                </div>
                <h2 className="text-exam-ink font-semibold text-lg mb-2">
                  Warning {tabLeaveCount} of 2
                </h2>
                <p className="text-exam-ink-muted text-sm leading-relaxed mb-6">
                  You left the test tab. <strong className="text-exam-ink">Next time your progress will be permanently reset.</strong>{' '}
                  Stay on this tab until you submit.
                </p>
                <motion.button
                  onClick={onDismiss}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring' as const, stiffness: 400, damping: 22 }}
                  className="w-full py-3 rounded-xl bg-exam-maroon hover:bg-exam-maroon-bright text-exam-ink font-medium text-sm transition-colors"
                >
                  I understand — return to test
                </motion.button>
              </>
            )}

            {action === 'reset' && (
              <>
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-exam-danger/10 border border-exam-danger/30 mb-4">
                  <RotateCcw className="w-7 h-7 text-exam-danger" />
                </div>
                <h2 className="text-exam-ink font-semibold text-lg mb-2">
                  Progress Reset
                </h2>
                <p className="text-exam-ink-muted text-sm leading-relaxed mb-6">
                  You left the tab a second time. <strong className="text-exam-ink">All your saved answers have been wiped.</strong>{' '}
                  The timer is still running. One more violation and you will be banned.
                </p>
                <motion.button
                  onClick={onDismiss}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring' as const, stiffness: 400, damping: 22 }}
                  className="w-full py-3 rounded-xl bg-exam-maroon hover:bg-exam-maroon-bright text-exam-ink font-medium text-sm transition-colors"
                >
                  Continue the test
                </motion.button>
              </>
            )}

            {action === 'ban' && (
              <>
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-exam-danger/10 border border-exam-danger/30 mb-4">
                  <Ban className="w-7 h-7 text-exam-danger" />
                </div>
                <h2 className="text-exam-ink font-semibold text-lg mb-2 text-exam-danger">
                  Access Revoked
                </h2>
                <p className="text-exam-ink-muted text-sm leading-relaxed">
                  You have been <strong className="text-exam-danger">banned from this test</strong> due to repeated tab-switching violations.
                  Please contact an admin to appeal.
                </p>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

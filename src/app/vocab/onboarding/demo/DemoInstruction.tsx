'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Pointer, Check } from 'lucide-react';

interface DemoInstructionProps {
  /** Instruction text shown while user still needs to interact */
  activeText: string;
  /** Text shown after user completes the interaction */
  doneText: string;
  /** Whether the interaction is complete */
  done: boolean;
  /** Optional progress string, e.g. "1/3" — shown in bottom counter */
  progress?: string;
}

const spring = { type: 'spring' as const, stiffness: 380, damping: 26 };

export default function DemoInstruction({
  activeText,
  doneText,
  done,
  progress,
}: DemoInstructionProps) {
  return (
    <>
      {/* Top instruction bar */}
      <AnimatePresence mode="wait">
        <motion.div
          key={done ? 'done' : 'active'}
          initial={{ opacity: 0, y: -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.97 }}
          transition={spring}
          className="flex items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5"
          style={{
            background: done
              ? 'rgba(34,197,94,0.08)'
              : 'rgba(230,57,70,0.08)',
            border: `1px solid ${done ? 'rgba(34,197,94,0.25)' : 'rgba(230,57,70,0.2)'}`,
            alignSelf: 'center',
          }}
        >
          {done ? (
            <Check
              size={13}
              style={{ color: 'var(--color-lx-success)', flexShrink: 0 }}
            />
          ) : (
            <motion.div
              animate={{ y: [0, -2, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Pointer
                size={13}
                style={{ color: 'var(--color-lx-accent-red)', flexShrink: 0 }}
              />
            </motion.div>
          )}
          <span
            style={{
              fontFamily: "'Sora', sans-serif",
              fontSize: '0.68rem',
              fontWeight: 600,
              color: done
                ? 'var(--color-lx-success)'
                : 'var(--color-lx-text-secondary)',
              whiteSpace: 'nowrap',
            }}
          >
            {done ? doneText : activeText}
          </span>
        </motion.div>
      </AnimatePresence>

      {/* Bottom progress counter (only when not done and progress provided) */}
      {!done && progress && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: '0.62rem',
            fontWeight: 500,
            color: 'var(--color-lx-text-muted)',
            textAlign: 'center',
            marginTop: 2,
          }}
        >
          {progress}
        </motion.p>
      )}
    </>
  );
}

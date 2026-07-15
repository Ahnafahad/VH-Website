'use client';

/**
 * FullAccessDeadlineModal
 *
 * Shown once on the home screen after a student is upgraded to full
 * LexiCore access (phase 1). Their earlier onboarding target date only
 * covered the free 104-word pool — this asks for a fresh target date
 * covering the full 805-word library, and logs it via PATCH /api/vocab/profile.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PAID_WORD_POOL } from '@/lib/vocab/constants';

function defaultDeadline(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return d;
}

function wordsPerDay(deadline: Date): number {
  const days = Math.max(1, Math.ceil((deadline.getTime() - Date.now()) / 86400000));
  return Math.ceil(PAID_WORD_POOL / days);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function FullAccessDeadlineModal({ onDone }: { onDone: () => void }) {
  const [deadline, setDeadline] = useState<Date>(defaultDeadline);
  const [wpd, setWpd]           = useState(() => wordsPerDay(defaultDeadline()));
  const [saving, setSaving]     = useState(false);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const d = new Date(e.target.value);
    if (!isNaN(d.getTime())) {
      setDeadline(d);
      setWpd(wordsPerDay(d));
    }
  }, []);

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 7);

  const save = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      await fetch('/api/vocab/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } finally {
      onDone();
    }
  };

  const handleConfirm = () => save({ deadline: deadline.toISOString(), recalculateDailyTarget: true });
  const handleSkip    = () => save({ dismissFullAccessDeadlinePrompt: true });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          style={{
            background: 'var(--color-lx-surface)',
            border: '1px solid var(--color-lx-border)',
            borderRadius: 20,
            padding: '1.75rem 1.5rem',
            maxWidth: 420,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.75rem',
          }}
        >
          <div className="flex flex-col gap-2">
            <h2
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize:   '1.6rem',
                fontWeight: 700,
                fontStyle:  'italic',
                lineHeight: 1.15,
                color:      'var(--color-lx-text-primary)',
                margin:     0,
              }}
            >
              You now have full access
            </h2>
            <p
              style={{
                fontFamily: "'Sora', sans-serif",
                fontSize:   '0.84rem',
                color:      'var(--color-lx-text-secondary)',
                lineHeight: 1.5,
              }}
            >
              You&apos;ve been upgraded to all {PAID_WORD_POOL}+ words. When do you want to finish the entire list by?
            </p>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div
              className="rounded-full px-6 py-3 text-base font-semibold"
              style={{ background: 'var(--color-lx-accent-red)', color: '#fff', fontFamily: "'Sora', sans-serif" }}
            >
              {formatDate(deadline)}
            </div>

            <input
              type="date"
              min={minDate.toISOString().split('T')[0]}
              defaultValue={defaultDeadline().toISOString().split('T')[0]}
              onChange={handleChange}
              className="w-full rounded-[10px] border px-4 py-3 text-sm"
              style={{
                background:  'var(--form-field-bg)',
                borderColor: 'var(--form-border)',
                color:       'var(--form-input-text)',
                colorScheme: 'dark',
                fontFamily:  "'Sora', sans-serif",
              }}
            />
          </div>

          <motion.div
            key={wpd}
            initial={{ opacity: 0.5, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl p-4 text-center"
            style={{ background: 'var(--color-lx-surface-alt, rgba(255,255,255,0.04))', border: '1px solid var(--color-lx-border)' }}
          >
            <span
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize:   '2.4rem',
                fontWeight: 700,
                lineHeight: 1,
                color:      'var(--color-lx-accent-red)',
              }}
            >
              ~{wpd}
            </span>
            <p
              style={{
                fontFamily: "'Sora', sans-serif",
                fontSize:   '0.8rem',
                color:      'var(--color-lx-text-secondary)',
                marginTop:  4,
              }}
            >
              words to review per day
            </p>
          </motion.div>

          <div className="flex flex-col gap-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleConfirm}
              disabled={saving}
              className="w-full rounded-[10px] py-3.5 text-base font-semibold text-white"
              style={{
                background: 'linear-gradient(135deg, var(--color-lx-accent-red) 0%, #c42d39 100%)',
                fontFamily: "'Sora', sans-serif",
                opacity: saving ? 0.7 : 1,
              }}
            >
              Lock in my target date
            </motion.button>
            <button
              onClick={handleSkip}
              disabled={saving}
              className="w-full text-center py-2 text-sm"
              style={{
                fontFamily: "'Sora', sans-serif",
                color: 'var(--color-lx-text-muted)',
                background: 'transparent',
              }}
            >
              I&apos;ll set this later
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';

const TOTAL_WORDS = 800;

function defaultDeadline(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return d;
}

function wordsPerDay(deadline: Date): number {
  const days = Math.max(1, Math.ceil((deadline.getTime() - Date.now()) / 86400000));
  return Math.ceil(TOTAL_WORDS / days);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

interface Props {
  onNext: (deadline: Date) => void;
}

export default function StepDeadline({ onNext }: Props) {
  const [deadline, setDeadline] = useState<Date>(defaultDeadline);
  const [wpd, setWpd]           = useState(() => wordsPerDay(defaultDeadline()));

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const d = new Date(e.target.value);
    if (!isNaN(d.getTime())) {
      setDeadline(d);
      setWpd(wordsPerDay(d));
    }
  }, []);

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 7);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold" style={{ color: 'var(--color-lx-text-primary)' }}>
          When do you want to be done?
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-lx-text-secondary)' }}>
          We'll build a daily study plan around your target date.
        </p>
      </div>

      {/* Date display pill */}
      <div className="flex flex-col items-center gap-4">
        <div
          className="rounded-full px-6 py-3 text-base font-semibold"
          style={{ background: 'var(--color-lx-accent-red)', color: '#fff' }}
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
          }}
        />
      </div>

      {/* Live words/day calculation */}
      <motion.div
        key={wpd}
        initial={{ opacity: 0.5, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl p-4 text-center"
        style={{ background: 'var(--color-lx-surface)', border: '1px solid var(--color-lx-border)' }}
      >
        <span className="text-3xl font-bold" style={{ color: 'var(--color-lx-accent-red)' }}>
          ~{wpd}
        </span>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-lx-text-secondary)' }}>
          words to review per day
        </p>
        <p className="mt-2 text-xs" style={{ color: 'var(--color-lx-text-muted)' }}>
          800 words total · first 100 are free
        </p>
      </motion.div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => onNext(deadline)}
        className="w-full rounded-[10px] py-4 text-lg font-semibold text-white"
        style={{ background: 'var(--color-lx-accent-red)' }}
      >
        Confirm Deadline
      </motion.button>
    </div>
  );
}

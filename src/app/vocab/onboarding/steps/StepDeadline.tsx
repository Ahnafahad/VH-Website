'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { LexiArtwork } from '@/components/vocab/LexiAsset';

const TOTAL_WORDS = 100;

function defaultDeadline(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
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
  /** Receives the chosen deadline AND the computed words-per-day for the Projection step */
  onNext: (deadline: Date, wordsPerDay: number) => void;
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
        {/* FIX: was using Tailwind font classes (text-xl font-bold) — now uses the canonical serif */}
        <h2
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize:   '1.75rem',
            fontWeight: 700,
            fontStyle:  'italic',
            lineHeight: 1.15,
            color:      'var(--color-lx-text-primary)',
            margin:     0,
          }}
        >
          When is your exam?
        </h2>
        <p
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize:   '0.84rem',
            color:      'var(--color-lx-text-secondary)',
            lineHeight: 1.5,
          }}
        >
          Set your target date and we&apos;ll build a daily plan so you master all 100 words before exam day — not the night before.
        </p>
      </div>

      <LexiArtwork path="onboarding/pace-deadline.webp" width={112} height={112} style={{ margin: '-0.75rem auto' }} />

      {/* Date display pill */}
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

      {/* Live words/day calculation */}
      <motion.div
        key={wpd}
        initial={{ opacity: 0.5, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl p-4 text-center"
        style={{ background: 'var(--color-lx-surface)', border: '1px solid var(--color-lx-border)' }}
      >
        <span
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize:   '2.8rem',
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
        <p
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize:   '0.7rem',
            color:      'var(--color-lx-text-muted)',
            marginTop:  6,
          }}
        >
          100 words in your free plan · upgrade anytime for 800+
        </p>
      </motion.div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => onNext(deadline, wpd)}
        className="w-full rounded-[10px] py-4 text-lg font-semibold text-white"
        style={{
          background: 'linear-gradient(135deg, var(--color-lx-accent-red) 0%, #c42d39 100%)',
          fontFamily: "'Sora', sans-serif",
          boxShadow:  '0 4px 20px rgba(230,57,70,0.35)',
        }}
      >
        Lock in my target date
      </motion.button>
    </div>
  );
}

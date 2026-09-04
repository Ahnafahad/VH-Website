'use client';

/**
 * NewSyllabusesModal
 *
 * A mini "Choose your syllabus" screen, shown once on the home screen to
 * existing users when a syllabus was added after they finished onboarding.
 * Mirrors FullAccessDeadlineModal's chrome/lifecycle: PATCH then onDone().
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Syllabus { id: number; name: string; description: string | null }

export default function NewSyllabusesModal({ syllabuses, onDone }: {
  syllabuses: Syllabus[];
  onDone: () => void;
}) {
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const toggle = (id: number) => {
    setChosen(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      await fetch('/api/vocab/syllabuses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } finally {
      onDone();
    }
  };

  const handleConfirm = () => save({ action: 'add', syllabusIds: [...chosen] });
  const handleSkip    = () => save({ action: 'skip' });

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
            gap: '1.5rem',
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
              New syllabuses are here
            </h2>
            <p
              style={{
                fontFamily: "'Sora', sans-serif",
                fontSize:   '0.84rem',
                color:      'var(--color-lx-text-secondary)',
                lineHeight: 1.5,
              }}
            >
              Pick any you want to study for — you can change this later from Study or Practice.
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            {syllabuses.map(s => {
              const on = chosen.has(s.id);
              return (
                <motion.button
                  key={s.id}
                  onClick={() => toggle(s.id)}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                  aria-pressed={on}
                  className="rounded-2xl px-4 py-3.5 text-left"
                  style={{
                    fontFamily: "'Sora', sans-serif",
                    background: on ? 'rgba(230,57,70,0.10)' : 'var(--color-lx-elevated)',
                    border: `1px solid ${on ? 'var(--color-lx-accent-red)' : 'var(--color-lx-border)'}`,
                    boxShadow: on ? '0 0 0 3px rgba(230,57,70,0.1)' : 'none',
                    color: 'var(--color-lx-text-primary)',
                  }}
                >
                  <span className="text-[0.95rem] font-semibold">{s.name}</span>
                  {s.description && (
                    <span className="mt-1 block text-xs" style={{ color: 'var(--color-lx-text-muted)' }}>
                      {s.description}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleConfirm}
              disabled={saving || chosen.size === 0}
              className="w-full rounded-[10px] py-3.5 text-base font-semibold text-white"
              style={{
                background: 'linear-gradient(135deg, var(--color-lx-accent-red) 0%, #c42d39 100%)',
                fontFamily: "'Sora', sans-serif",
                opacity: saving || chosen.size === 0 ? 0.5 : 1,
              }}
            >
              {chosen.size > 0 ? `Add ${chosen.size} syllabus${chosen.size === 1 ? '' : 'es'}` : 'Add syllabuses'}
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
              Not now
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

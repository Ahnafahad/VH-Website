'use client';

/**
 * ReducedOnboardingModal
 *
 * A two-stage completion flow for old, syllabus-locked users who never went
 * through onboarding: flip-and-tweak the flashcard style, then confirm what
 * they're studying for. Shown once on Home; also reachable any time from
 * Study/Practice while locked, since a one-shot popup users can dismiss with
 * the back button isn't a real entry point.
 */

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import LivingFlashcard, { type LivingCardWord } from '@/components/vocab/LivingFlashcard';
import { CardStyleChips, PrimaryButton } from '@/components/vocab/onboarding/ui';
import type { CardPrefs } from '@/lib/vocab/card-prefs';

interface Syllabus { id: number; name: string; description: string | null }

type Stage = 'card' | 'syllabus';

export default function ReducedOnboardingModal({
  syllabuses,
  selectedSyllabusIds,
  cardPrefs: initialPrefs,
  sampleWord,
  onDone,
}: {
  syllabuses: Syllabus[];
  selectedSyllabusIds: number[];
  cardPrefs: CardPrefs;
  sampleWord: LivingCardWord | null;
  onDone: () => void;
}) {
  const reduce = useReducedMotion() ?? false;
  const [stage, setStage]     = useState<Stage>(sampleWord ? 'card' : 'syllabus');
  const [flipped, setFlipped] = useState(false);
  const [prefs, setPrefs]     = useState<CardPrefs>(initialPrefs);
  const [chosen, setChosen]   = useState<Set<number>>(new Set(selectedSyllabusIds));
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(false);

  const toggle = (id: number) => {
    setChosen(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id); // at least one must stay selected
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const submit = async () => {
    setSaving(true);
    setError(false);
    try {
      const res = await fetch('/api/vocab/onboarding/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefs, syllabusIds: [...chosen] }),
      });
      if (!res.ok) {
        setError(true);
        return;
      }
      onDone();
    } finally {
      setSaving(false);
    }
  };

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
            maxWidth: 460,
            width: '100%',
            maxHeight: 'min(92vh, 720px)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          <AnimatePresence mode="wait">
            {stage === 'card' && sampleWord && (
              <motion.div
                key="card"
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0.12 : 0.24, ease: [0.4, 0, 0.2, 1] }}
                className="flex flex-col gap-4"
              >
                <Header
                  title="Set up your card"
                  subtitle={flipped ? 'Keep what helps you, drop what doesn’t.' : 'Tap the card to flip it.'}
                />

                <div className="relative w-full" style={{ minHeight: 'min(48vh, 360px)', display: 'flex' }}>
                  <LivingFlashcard
                    word={sampleWord}
                    prefs={prefs}
                    isFlipped={flipped}
                    onFlip={() => setFlipped(true)}
                    onFlipBack={() => setFlipped(false)}
                    reduce={reduce}
                  />
                </div>

                <AnimatePresence>
                  {flipped && (
                    <motion.div
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: reduce ? 0.12 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className="flex flex-col gap-3"
                    >
                      <CardStyleChips prefs={prefs} setPrefs={setPrefs} />
                      <PrimaryButton onClick={() => setStage('syllabus')}>This is my card</PrimaryButton>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {stage === 'syllabus' && (
              <motion.div
                key="syllabus"
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0.12 : 0.24, ease: [0.4, 0, 0.2, 1] }}
                className="flex flex-col gap-4"
              >
                <Header
                  title="What are you studying for?"
                  subtitle="You’re set up for WordSmart — add SAT or GRE if you need them, or just confirm to continue."
                />

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

                <PrimaryButton onClick={submit} disabled={saving || chosen.size === 0}>
                  {saving ? 'Saving…' : 'Confirm and continue'}
                </PrimaryButton>

                {error && (
                  <p role="alert" style={{ fontFamily: "'Sora', sans-serif", fontSize: '0.78rem', color: 'var(--color-lx-danger)', textAlign: 'center', margin: 0 }}>
                    Couldn’t save that — check your connection and try again.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
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
        {title}
      </h2>
      <p
        style={{
          fontFamily: "'Sora', sans-serif",
          fontSize:   '0.84rem',
          color:      'var(--color-lx-text-secondary)',
          lineHeight: 1.5,
          margin:     0,
        }}
      >
        {subtitle}
      </p>
    </div>
  );
}

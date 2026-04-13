'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { useRouter } from 'next/navigation';
import type { PracticePageData } from '@/lib/vocab/practice-data';
import type { LetterSummary } from '@/lib/vocab/letter-data';

type PracticeTab = 'theme' | 'letter';

// ─── Tab switcher ─────────────────────────────────────────────────────────────

function TabSwitcher({ active, onChange }: { active: PracticeTab; onChange: (t: PracticeTab) => void }) {
  return (
    <div style={{
      display: 'flex', gap: 0,
      borderBottom: '1px solid var(--color-lx-border)',
      marginBottom: '1rem', position: 'relative',
    }}>
      {(['theme', 'letter'] as PracticeTab[]).map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          style={{
            padding: '0.5rem 1.25rem',
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: "'Sora', sans-serif",
            fontSize: '0.8125rem', fontWeight: 600,
            color: active === tab ? 'var(--color-lx-text-primary)' : 'var(--color-lx-text-muted)',
            position: 'relative',
          }}
        >
          {tab === 'theme' ? 'By Theme' : 'By Letter'}
          {active === tab && (
            <motion.div
              layoutId="practice-tab-indicator"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              style={{
                position: 'absolute', bottom: -1, left: 0, right: 0,
                height: 2, background: 'var(--color-lx-accent-red)', borderRadius: 1,
              }}
            />
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Letter grid card ─────────────────────────────────────────────────────────

interface LetterCardProps {
  summary:  LetterSummary;
  selected: boolean;
  onToggle: () => void;
}

function LetterCard({ summary, selected, onToggle }: LetterCardProps) {
  const masteryPct    = summary.wordCount > 0 ? summary.familiarPlusCount / summary.wordCount : 0;
  const masteryPctInt = Math.round(masteryPct * 100);
  const barColor = masteryPct >= 0.8
    ? 'var(--color-lx-accent-gold)'
    : masteryPct >= 0.4
      ? '#f97316'
      : 'var(--color-lx-accent-red)';

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      whileTap={{ scale: 0.94 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      onClick={onToggle}
      style={{
        background: selected ? 'rgba(230,57,70,0.08)' : 'var(--color-lx-surface)',
        border: selected ? '1.5px solid rgba(230,57,70,0.5)' : '1px solid var(--color-lx-border)',
        borderRadius: 16,
        padding: '0.875rem 0.75rem 0.75rem',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem',
        boxShadow: selected ? '0 0 0 1px rgba(230,57,70,0.2) inset' : 'none',
        transition: 'background 0.18s, border-color 0.18s, box-shadow 0.18s',
        position: 'relative',
        width: '100%',
      }}
    >
      {/* Selection indicator */}
      {selected && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 480, damping: 26 }}
          style={{
            position: 'absolute', top: 5, right: 5,
            width: 14, height: 14,
            borderRadius: '50%',
            background: 'var(--color-lx-accent-red)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 4l2 2 3-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
      )}

      {/* Letter */}
      <span style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: '2rem', fontWeight: 700,
        color: selected ? 'var(--color-lx-accent-red)' : 'var(--color-lx-text-primary)',
        lineHeight: 1,
        transition: 'color 0.18s',
      }}>
        {summary.letter}
      </span>

      {/* Mastered / Total */}
      <span style={{
        fontFamily: "'Sora', sans-serif",
        fontSize: '0.6rem', fontWeight: 600,
        color: 'var(--color-lx-text-secondary)',
        lineHeight: 1,
      }}>
        {summary.familiarPlusCount}/{summary.wordCount}
      </span>

      {/* Progress bar */}
      <div style={{
        width: '100%', height: 3,
        background: 'var(--color-lx-elevated)',
        borderRadius: 2, overflow: 'hidden',
      }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${masteryPctInt}%` }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
          style={{ height: '100%', background: barColor, borderRadius: 2 }}
        />
      </div>

      {/* Mastery % */}
      <span style={{
        fontFamily: "'Sora', sans-serif",
        fontSize: '0.55rem', fontWeight: 500,
        color: masteryPctInt > 0 ? barColor : 'var(--color-lx-text-muted)',
        lineHeight: 1,
      }}>
        {masteryPctInt}%
      </span>
    </motion.button>
  );
}

// ─── Animated SVG checkbox ────────────────────────────────────────────────────

function AnimatedCheck({ checked }: { checked: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <motion.rect
        x="1" y="1" width="20" height="20" rx="5"
        stroke="var(--color-lx-accent-red)"
        strokeWidth="1.5"
        animate={{
          strokeOpacity: checked ? 1 : 0.35,
          fill: checked ? 'rgba(230,57,70,0.15)' : 'transparent',
        }}
        transition={{ duration: 0.18 }}
      />
      <motion.path
        d="M6 11.5l3.5 3.5 6.5-7"
        stroke="var(--color-lx-accent-red)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{
          pathLength: checked ? 1 : 0,
          opacity:    checked ? 1 : 0,
        }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
      />
    </svg>
  );
}

// ─── Unit card ────────────────────────────────────────────────────────────────

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 340, damping: 28 } },
};

interface ThemeCardProps {
  name:          string;
  wordCount:     number;
  masteredCount: number;
  selected:      boolean;
  onToggle:      () => void;
}

function ThemeCard({ name, wordCount, masteredCount, selected, onToggle }: ThemeCardProps) {
  const masteredPct = wordCount > 0 ? Math.round((masteredCount / wordCount) * 100) : 0;

  return (
    <motion.button
      variants={cardVariants}
      onClick={onToggle}
      whileTap={{ scale: 0.975 }}
      className="w-full text-left"
      style={{ cursor: 'pointer' }}
    >
      <motion.div
        animate={{
          borderColor: selected ? 'rgba(230,57,70,0.45)' : 'var(--color-lx-border)',
          background:  selected ? 'rgba(230,57,70,0.05)' : 'var(--color-lx-surface)',
          boxShadow:   selected ? '0 0 0 1px rgba(230,57,70,0.25) inset' : 'none',
        }}
        transition={{ duration: 0.2 }}
        className="flex items-center gap-4 rounded-2xl px-4 py-4"
        style={{ border: '1px solid var(--color-lx-border)' }}
      >
        {/* Left: name + meta */}
        <div className="flex flex-1 flex-col gap-1.5 min-w-0">
          <span
            className="truncate font-semibold"
            style={{
              fontFamily: "'Sora', sans-serif",
              fontSize:   '0.95rem',
              color:      'var(--color-lx-text-primary)',
            }}
          >
            {name}
          </span>

          <div className="flex items-center gap-3">
            <span
              className="text-xs"
              style={{ color: 'var(--color-lx-text-muted)', fontFamily: "'Sora', sans-serif" }}
            >
              {wordCount} words
            </span>
            {masteredCount > 0 && (
              <span
                className="text-xs"
                style={{ color: 'var(--color-lx-success)', fontFamily: "'Sora', sans-serif" }}
              >
                {masteredPct}% mastered
              </span>
            )}
          </div>

          {/* Micro progress bar */}
          {wordCount > 0 && (
            <div
              className="overflow-hidden rounded-full"
              style={{ height: 2, background: 'var(--color-lx-elevated)', width: '100%' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'var(--color-lx-success)' }}
                initial={{ width: 0 }}
                animate={{ width: `${masteredPct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
              />
            </div>
          )}
        </div>

        {/* Right: animated checkbox */}
        <div className="shrink-0">
          <AnimatedCheck checked={selected} />
        </div>
      </motion.div>
    </motion.button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const containerVariants: Variants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.055 } },
};

export default function PracticeScreen({ data }: { data: PracticePageData }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<PracticeTab>('theme');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectedLetters, setSelectedLetters] = useState<Set<string>>(new Set());

  const toggle = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleLetter = (letter: string) => {
    setSelectedLetters(prev => {
      const next = new Set(prev);
      if (next.has(letter)) next.delete(letter);
      else next.add(letter);
      return next;
    });
  };

  const selectedThemes = useMemo(
    () => data.themes.filter(t => selected.has(t.id)),
    [data.themes, selected],
  );

  const totalSelectedWords = useMemo(
    () => selectedThemes.reduce((s, t) => s + t.wordCount, 0),
    [selectedThemes],
  );

  const totalLetterWords = useMemo(() => {
    return data.letters
      .filter(l => selectedLetters.has(l.letter))
      .reduce((s, l) => s + l.wordCount, 0);
  }, [data.letters, selectedLetters]);

  const handleStart = () => {
    if (activeTab === 'theme') {
      if (selected.size === 0) return;
      const param = Array.from(selected).join(',');
      router.push(`/vocab/practice/quiz?themes=${param}`);
    } else {
      if (selectedLetters.size === 0) return;
      const wordIds = data.letters
        .filter(l => selectedLetters.has(l.letter))
        .flatMap(l => l.wordIds);
      if (wordIds.length === 0) return;
      router.push(`/vocab/practice/quiz?wordIds=${wordIds.join(',')}`);
    }
  };

  /* ── Empty state: no themes ── */
  if (data.themes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 px-6 pt-24 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring' as const, stiffness: 280, damping: 20 }}
        >
          <p
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize:   '1.8rem',
              fontWeight: 700,
              fontStyle:  'italic',
              color:      'var(--color-lx-text-primary)',
            }}
          >
            No units yet
          </p>
          <p
            className="mt-2 text-sm"
            style={{ color: 'var(--color-lx-text-muted)', fontFamily: "'Sora', sans-serif" }}
          >
            Themes will appear here once the word bank is loaded.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col md:max-w-2xl md:mx-auto md:w-full"
      style={{ minHeight: 'calc(100dvh - 72px)', paddingBottom: (activeTab === 'theme' && selected.size > 0) || (activeTab === 'letter' && selectedLetters.size > 0) ? 112 : 32 }}
    >
      {/* ── Header ── */}
      <div className="px-5 pt-10 pb-6 md:px-8 md:pt-12">
        <motion.p
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="text-xs font-medium tracking-widest uppercase mb-1"
          style={{ color: 'var(--color-lx-text-muted)', fontFamily: "'Sora', sans-serif" }}
        >
          Practice Mode
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize:   'clamp(2rem, 8vw, 2.5rem)',
            fontWeight: 700,
            fontStyle:  'italic',
            lineHeight: 1.05,
            color:      'var(--color-lx-text-primary)',
          }}
        >
          {activeTab === 'theme' ? 'Select Themes' : 'Select Letters'}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="mt-2 text-sm"
          style={{ color: 'var(--color-lx-text-secondary)', fontFamily: "'Sora', sans-serif" }}
        >
          {activeTab === 'theme' ? 'Choose which themes to include in your practice quiz' : 'Tap letters to include in your practice quiz'}
        </motion.p>
      </div>

      {/* ── Tab switcher ── */}
      <div className="px-5 md:px-8">
        <TabSwitcher active={activeTab} onChange={(t) => { setActiveTab(t); setSelected(new Set()); setSelectedLetters(new Set()); }} />
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'theme' ? (
          <motion.div
            key="theme-tab"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* ── Select all / deselect all ── */}
            <div className="px-5 mb-3 flex items-center justify-between md:px-8">
              <span
                className="text-xs uppercase tracking-widest font-medium"
                style={{ color: 'var(--color-lx-text-muted)', fontFamily: "'Sora', sans-serif" }}
              >
                {data.themes.length} themes
              </span>
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={() => {
                  if (selected.size === data.themes.length) setSelected(new Set());
                  else setSelected(new Set(data.themes.map(t => t.id)));
                }}
                className="text-xs font-semibold"
                style={{ color: 'var(--color-lx-accent-red)', fontFamily: "'Sora', sans-serif" }}
              >
                {selected.size === data.themes.length ? 'Deselect all' : 'Select all'}
              </motion.button>
            </div>

            {/* ── Theme list ── */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="flex flex-col gap-2.5 px-5 md:px-8"
            >
              {data.themes.map(theme => (
                <ThemeCard
                  key={theme.id}
                  name={theme.name}
                  wordCount={theme.wordCount}
                  masteredCount={theme.masteredCount}
                  selected={selected.has(theme.id)}
                  onToggle={() => toggle(theme.id)}
                />
              ))}
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="letter-tab"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="px-5 md:px-8 pb-8"
          >
            {data.letters.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-lx-text-muted)', fontFamily: "'Sora', sans-serif" }}>
                No words in the library yet.
              </p>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                gap: 10,
              }}>
                {data.letters.map((summary, i) => (
                  <motion.div
                    key={summary.letter}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.025, type: 'spring', stiffness: 360, damping: 28 }}
                  >
                    <LetterCard
                      summary={summary}
                      selected={selectedLetters.has(summary.letter)}
                      onToggle={() => toggleLetter(summary.letter)}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating Start Practice button ── */}
      {/* CSS-only show/hide — Framer Motion y:80 initial gets stuck on mobile,
          and transform-based animations break position:fixed children. */}
      {(() => {
        const show = (activeTab === 'theme' && selected.size > 0) || (activeTab === 'letter' && selectedLetters.size > 0);
        return (
          <div
            className="lx-practice-cta"
            style={{ opacity: show ? 1 : 0, pointerEvents: show ? 'auto' : 'none', transition: 'opacity 0.22s ease' }}
          >
            <motion.button
              onClick={handleStart}
              whileTap={{ scale: 0.97 }}
              className="w-full md:max-w-2xl md:mx-auto rounded-2xl py-4 flex items-center justify-between px-6"
              style={{ background: 'var(--color-lx-accent-red)', boxShadow: '0 4px 24px rgba(230,57,70,0.4)', fontFamily: "'Sora', sans-serif" }}
            >
              <div className="flex flex-col items-start">
                <span className="text-base font-bold text-white leading-tight">Start Practice</span>
                <span className="text-xs text-white/70 mt-0.5">
                  {activeTab === 'theme'
                    ? `${selected.size} theme${selected.size !== 1 ? 's' : ''} · up to ${Math.min(totalSelectedWords, 20)} questions`
                    : `${selectedLetters.size} letter${selectedLetters.size !== 1 ? 's' : ''} · up to ${Math.min(totalLetterWords, 20)} questions`}
                </span>
              </div>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                <path d="M4 11h14M13 6l5 5-5 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.button>
          </div>
        );
      })()}
    </div>
  );
}

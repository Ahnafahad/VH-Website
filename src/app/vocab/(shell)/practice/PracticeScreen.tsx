'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { useRouter } from 'next/navigation';
import type { PracticePageData, PracticeUnitItem } from '@/lib/vocab/practice-data';

type PracticeTab = 'unit' | 'letter';

// ─── Tab switcher ─────────────────────────────────────────────────────────────

function TabSwitcher({ active, onChange }: { active: PracticeTab; onChange: (t: PracticeTab) => void }) {
  return (
    <div style={{
      display: 'flex', gap: 0,
      borderBottom: '1px solid var(--color-lx-border)',
      marginBottom: '1rem', position: 'relative',
    }}>
      {(['unit', 'letter'] as PracticeTab[]).map(tab => (
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
          {tab === 'unit' ? 'By Unit' : 'By Letter'}
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
  summary:  import('@/lib/vocab/letter-data').LetterSummary;
  selected: boolean;
  onToggle: () => void;
}

function LetterCard({ summary, selected, onToggle }: LetterCardProps) {
  const studiedPct = summary.wordCount > 0 ? summary.studiedCount      / summary.wordCount : 0;
  const masteryPct = summary.wordCount > 0 ? summary.familiarPlusCount / summary.wordCount : 0;
  const masteryBarColor = masteryPct >= 0.8
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
        padding: '0.875rem 0.625rem 0.75rem',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.45rem',
        boxShadow: selected ? '0 0 0 1px rgba(230,57,70,0.2) inset' : 'none',
        transition: 'background 0.18s, border-color 0.18s, box-shadow 0.18s',
        position: 'relative',
        width: '100%',
      }}
    >
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
      <span style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: '2rem', fontWeight: 700,
        color: selected ? 'var(--color-lx-accent-red)' : 'var(--color-lx-text-primary)',
        lineHeight: 1, transition: 'color 0.18s',
      }}>
        {summary.letter}
      </span>

      {/* Dual-layer progress bar: studied (muted) + mastered (accent) */}
      <div style={{
        width: '100%', height: 4,
        background: 'var(--color-lx-elevated)',
        borderRadius: 2, overflow: 'hidden',
        position: 'relative',
      }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.round(studiedPct * 100)}%` }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
          style={{
            height: '100%',
            background: 'var(--color-lx-text-muted)',
            opacity: 0.35,
            borderRadius: 2,
            position: 'absolute', left: 0, top: 0,
          }}
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.round(masteryPct * 100)}%` }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.2 }}
          style={{
            height: '100%',
            background: masteryBarColor,
            borderRadius: 2,
            position: 'absolute', left: 0, top: 0,
          }}
        />
      </div>

      {/* Two counts: studied · mastered */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.35rem',
        fontFamily: "'Sora', sans-serif", fontSize: '0.58rem', fontWeight: 600,
        lineHeight: 1, whiteSpace: 'nowrap',
      }}>
        <span style={{ color: summary.studiedCount > 0 ? 'var(--color-lx-text-secondary)' : 'var(--color-lx-text-muted)' }}>
          {summary.studiedCount} studied
        </span>
        <span style={{ color: 'var(--color-lx-text-muted)' }}>·</span>
        <span style={{ color: summary.familiarPlusCount > 0 ? masteryBarColor : 'var(--color-lx-text-muted)' }}>
          {summary.familiarPlusCount} mastered
        </span>
      </div>

      <span style={{
        fontFamily: "'Sora', sans-serif",
        fontSize: '0.52rem', fontWeight: 500,
        color: 'var(--color-lx-text-muted)',
        lineHeight: 1, letterSpacing: '0.04em',
      }}>
        of {summary.wordCount}
      </span>
    </motion.button>
  );
}

// ─── Animated checkbox ────────────────────────────────────────────────────────

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
        animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
      />
    </svg>
  );
}

// ─── Tri-state unit checkbox (none / partial / all) ───────────────────────────

function UnitCheckbox({ state }: { state: 'none' | 'partial' | 'all' }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <motion.rect
        x="1" y="1" width="20" height="20" rx="5"
        stroke="var(--color-lx-accent-gold)"
        strokeWidth="1.5"
        animate={{
          strokeOpacity: state === 'none' ? 0.3 : 1,
          fill: state === 'all'
            ? 'rgba(212,175,55,0.2)'
            : state === 'partial'
              ? 'rgba(212,175,55,0.08)'
              : 'transparent',
        }}
        transition={{ duration: 0.18 }}
      />
      {/* Partial: dash */}
      <motion.line
        x1="6.5" y1="11" x2="15.5" y2="11"
        stroke="var(--color-lx-accent-gold)"
        strokeWidth="2"
        strokeLinecap="round"
        initial={false}
        animate={{ opacity: state === 'partial' ? 1 : 0, scaleX: state === 'partial' ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      />
      {/* All: checkmark */}
      <motion.path
        d="M6 11.5l3.5 3.5 6.5-7"
        stroke="var(--color-lx-accent-gold)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={false}
        animate={{ pathLength: state === 'all' ? 1 : 0, opacity: state === 'all' ? 1 : 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
      />
    </svg>
  );
}

// ─── Theme row (inside accordion) ────────────────────────────────────────────

interface ThemeRowProps {
  name:          string;
  wordCount:     number;
  masteredCount: number;
  selected:      boolean;
  onToggle:      () => void;
}

function ThemeRow({ name, wordCount, masteredCount, selected, onToggle }: ThemeRowProps) {
  const masteredPct = wordCount > 0 ? Math.round((masteredCount / wordCount) * 100) : 0;

  return (
    <motion.button
      onClick={onToggle}
      whileTap={{ scale: 0.98 }}
      className="w-full text-left"
      style={{ cursor: 'pointer' }}
    >
      <motion.div
        animate={{
          borderColor: selected ? 'rgba(230,57,70,0.35)' : 'var(--color-lx-border)',
          background:  selected ? 'rgba(230,57,70,0.05)' : 'transparent',
        }}
        transition={{ duration: 0.18 }}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          border: '1px solid var(--color-lx-border)',
          borderRadius: 14, padding: '0.75rem 1rem',
          marginLeft: 4,
        }}
      >
        {/* Left bar accent when selected */}
        <motion.div
          animate={{ opacity: selected ? 1 : 0, scaleY: selected ? 1 : 0.4 }}
          transition={{ duration: 0.2 }}
          style={{
            width: 2, height: 28, borderRadius: 1, flexShrink: 0,
            background: 'var(--color-lx-accent-red)',
            transformOrigin: 'center',
          }}
        />

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: '0.875rem', fontWeight: 600,
            color: 'var(--color-lx-text-primary)',
            display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {name}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontFamily: "'Sora', sans-serif",
              fontSize: '0.7rem', color: 'var(--color-lx-text-muted)',
            }}>
              {wordCount} words
            </span>
            {masteredCount > 0 && (
              <span style={{
                fontFamily: "'Sora', sans-serif",
                fontSize: '0.7rem', color: 'var(--color-lx-success)',
              }}>
                {masteredPct}% mastered
              </span>
            )}
          </div>
          {wordCount > 0 && (
            <div style={{ height: 2, background: 'var(--color-lx-elevated)', borderRadius: 1, overflow: 'hidden', width: '100%' }}>
              <motion.div
                style={{ height: '100%', background: 'var(--color-lx-success)', borderRadius: 1 }}
                initial={{ width: 0 }}
                animate={{ width: `${masteredPct}%` }}
                transition={{ duration: 0.55, ease: 'easeOut', delay: 0.05 }}
              />
            </div>
          )}
        </div>

        <div style={{ flexShrink: 0 }}>
          <AnimatedCheck checked={selected} />
        </div>
      </motion.div>
    </motion.button>
  );
}

// ─── Unit accordion card ──────────────────────────────────────────────────────

const accordionBodyVariants: Variants = {
  collapsed: { height: 0, opacity: 0 },
  expanded:  { height: 'auto', opacity: 1, transition: { height: { type: 'spring' as const, stiffness: 380, damping: 36 }, opacity: { duration: 0.2 } } },
};

interface UnitAccordionCardProps {
  unit:           PracticeUnitItem;
  expanded:       boolean;
  onToggleExpand: () => void;
  selected:       Set<number>;
  onToggleTheme:  (id: number) => void;
  onSelectAll:    () => void;
  index:          number;
}

function UnitAccordionCard({ unit, expanded, onToggleExpand, selected, onToggleTheme, onSelectAll, index }: UnitAccordionCardProps) {
  const selectedCount = unit.themes.filter(t => selected.has(t.id)).length;
  const selectionState: 'none' | 'partial' | 'all' =
    selectedCount === 0 ? 'none' :
    selectedCount === unit.themes.length ? 'all' : 'partial';

  const masteredPct = unit.totalWords > 0 ? Math.round((unit.totalMastered / unit.totalWords) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring' as const, stiffness: 320, damping: 28, delay: index * 0.04 }}
      style={{
        border: selectionState !== 'none'
          ? '1px solid rgba(212,175,55,0.35)'
          : '1px solid var(--color-lx-border)',
        borderRadius: 18,
        overflow: 'hidden',
        background: selectionState !== 'none'
          ? 'rgba(212,175,55,0.03)'
          : 'var(--color-lx-surface)',
        transition: 'border-color 0.2s, background 0.2s',
      }}
    >
      {/* ── Unit header ── */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {/* Expand toggle — takes up most of the row */}
        <button
          onClick={onToggleExpand}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 12,
            padding: '1rem 0.75rem 1rem 1rem',
            background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
          }}
        >
          {/* Chevron */}
          <motion.svg
            width="16" height="16" viewBox="0 0 16 16" fill="none"
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{ flexShrink: 0, color: 'var(--color-lx-text-muted)' }}
          >
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </motion.svg>

          {/* Name + stats */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '1.05rem', fontWeight: 700, fontStyle: 'italic',
                color: 'var(--color-lx-text-primary)', lineHeight: 1.2,
              }}>
                {unit.name}
              </span>
              {selectedCount > 0 && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  style={{
                    fontFamily: "'Sora', sans-serif",
                    fontSize: '0.65rem', fontWeight: 700,
                    color: 'var(--color-lx-accent-gold)',
                    background: 'rgba(212,175,55,0.15)',
                    border: '1px solid rgba(212,175,55,0.3)',
                    borderRadius: 6, padding: '1px 6px',
                    letterSpacing: '0.02em',
                  }}
                >
                  {selectedCount}/{unit.themes.length}
                </motion.span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
              <span style={{
                fontFamily: "'Sora', sans-serif",
                fontSize: '0.7rem', color: 'var(--color-lx-text-muted)',
              }}>
                {unit.totalWords} words
              </span>
              {unit.totalMastered > 0 && (
                <span style={{
                  fontFamily: "'Sora', sans-serif",
                  fontSize: '0.7rem', color: 'var(--color-lx-success)',
                }}>
                  {masteredPct}% mastered
                </span>
              )}
              <span style={{
                fontFamily: "'Sora', sans-serif",
                fontSize: '0.7rem', color: 'var(--color-lx-text-muted)',
              }}>
                · {unit.themes.length} {unit.themes.length === 1 ? 'theme' : 'themes'}
              </span>
            </div>
          </div>
        </button>

        {/* Tri-state unit select-all button */}
        <button
          onClick={(e) => { e.stopPropagation(); onSelectAll(); }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem 1rem',
            background: 'none', border: 'none', cursor: 'pointer',
            borderLeft: '1px solid var(--color-lx-border)',
          }}
          title={selectionState === 'all' ? 'Deselect all themes in this unit' : 'Select all themes in this unit'}
        >
          <UnitCheckbox state={selectionState} />
        </button>
      </div>

      {/* ── Progress micro-bar ── */}
      {unit.totalWords > 0 && (
        <div style={{ height: 2, background: 'var(--color-lx-elevated)', margin: '0 1rem' }}>
          <motion.div
            style={{ height: '100%', background: 'var(--color-lx-success)' }}
            initial={{ width: 0 }}
            animate={{ width: `${masteredPct}%` }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: index * 0.04 + 0.2 }}
          />
        </div>
      )}

      {/* ── Accordion body: themes ── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="body"
            variants={accordionBodyVariants}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            style={{ overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0.75rem 0.75rem 0.875rem' }}>
              {unit.themes.map(theme => (
                <ThemeRow
                  key={theme.id}
                  name={theme.name}
                  wordCount={theme.wordCount}
                  masteredCount={theme.masteredCount}
                  selected={selected.has(theme.id)}
                  onToggle={() => onToggleTheme(theme.id)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PracticeScreen({ data }: { data: PracticePageData }) {
  const router = useRouter();
  const [activeTab, setActiveTab]         = useState<PracticeTab>('unit');
  const [selected, setSelected]           = useState<Set<number>>(new Set());
  const [selectedLetters, setSelectedLetters] = useState<Set<string>>(new Set());
  const [expandedUnits, setExpandedUnits] = useState<Set<number>>(new Set());

  // Flat list of all themes across all units
  const allThemes = useMemo(
    () => data.units.flatMap(u => u.themes),
    [data.units],
  );
  const allThemeIds = useMemo(
    () => allThemes.map(t => t.id),
    [allThemes],
  );

  const toggleTheme = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleUnitExpand = (unitId: number) => {
    setExpandedUnits(prev => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  };

  const selectAllInUnit = (unit: PracticeUnitItem) => {
    const unitThemeIds = unit.themes.map(t => t.id);
    const allSelected  = unitThemeIds.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) {
        unitThemeIds.forEach(id => next.delete(id));
      } else {
        unitThemeIds.forEach(id => next.add(id));
      }
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

  const totalSelectedWords = useMemo(
    () => allThemes.filter(t => selected.has(t.id)).reduce((s, t) => s + t.wordCount, 0),
    [allThemes, selected],
  );

  const totalLetterWords = useMemo(
    () => data.letters.filter(l => selectedLetters.has(l.letter)).reduce((s, l) => s + l.wordCount, 0),
    [data.letters, selectedLetters],
  );

  const handleStart = () => {
    if (activeTab === 'unit') {
      if (selected.size === 0) return;
      router.push(`/vocab/practice/quiz?themes=${Array.from(selected).join(',')}`);
    } else {
      if (selectedLetters.size === 0) return;
      const wordIds = data.letters.filter(l => selectedLetters.has(l.letter)).flatMap(l => l.wordIds);
      if (wordIds.length === 0) return;
      router.push(`/vocab/practice/quiz?wordIds=${wordIds.join(',')}`);
    }
  };

  /* ── Empty state ── */
  if (data.units.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 px-6 pt-24 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring' as const, stiffness: 280, damping: 20 }}
        >
          <p style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '1.8rem', fontWeight: 700, fontStyle: 'italic',
            color: 'var(--color-lx-text-primary)',
          }}>
            No units yet
          </p>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-lx-text-muted)', fontFamily: "'Sora', sans-serif" }}>
            Units will appear here once the word bank is loaded.
          </p>
        </motion.div>
      </div>
    );
  }

  const showCta = (activeTab === 'unit' && selected.size > 0) || (activeTab === 'letter' && selectedLetters.size > 0);

  return (
    <div
      className="flex flex-col md:max-w-2xl md:mx-auto md:w-full"
      style={{ minHeight: 'calc(100dvh - 72px)', paddingBottom: showCta ? 112 : 32 }}
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
            fontSize: 'clamp(2rem, 8vw, 2.5rem)', fontWeight: 700, fontStyle: 'italic',
            lineHeight: 1.05, color: 'var(--color-lx-text-primary)',
          }}
        >
          {activeTab === 'unit' ? 'Select Units' : 'Select Letters'}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="mt-2 text-sm"
          style={{ color: 'var(--color-lx-text-secondary)', fontFamily: "'Sora', sans-serif" }}
        >
          {activeTab === 'unit'
            ? 'Select a whole unit or pick individual themes to include'
            : 'Tap letters to include in your practice quiz'}
        </motion.p>
      </div>

      {/* ── Tab switcher ── */}
      <div className="px-5 md:px-8">
        <TabSwitcher
          active={activeTab}
          onChange={(t) => { setActiveTab(t); setSelected(new Set()); setSelectedLetters(new Set()); }}
        />
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'unit' ? (
          <motion.div
            key="unit-tab"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* ── Global select all / deselect all ── */}
            <div className="px-5 mb-3 flex items-center justify-between md:px-8">
              <span
                className="text-xs uppercase tracking-widest font-medium"
                style={{ color: 'var(--color-lx-text-muted)', fontFamily: "'Sora', sans-serif" }}
              >
                {data.units.length} units · {allThemes.length} themes
              </span>
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={() => {
                  if (selected.size === allThemeIds.length) setSelected(new Set());
                  else setSelected(new Set(allThemeIds));
                }}
                className="text-xs font-semibold"
                style={{ color: 'var(--color-lx-accent-red)', fontFamily: "'Sora', sans-serif" }}
              >
                {selected.size === allThemeIds.length ? 'Deselect all' : 'Select all'}
              </motion.button>
            </div>

            {/* ── Unit accordion list ── */}
            <div className="flex flex-col gap-2.5 px-5 md:px-8 pb-4">
              {data.units.map((unit, i) => (
                <UnitAccordionCard
                  key={unit.id}
                  unit={unit}
                  index={i}
                  expanded={expandedUnits.has(unit.id)}
                  onToggleExpand={() => toggleUnitExpand(unit.id)}
                  selected={selected}
                  onToggleTheme={toggleTheme}
                  onSelectAll={() => selectAllInUnit(unit)}
                />
              ))}
            </div>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 10 }}>
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
      <div
        className="lx-practice-cta"
        style={{ opacity: showCta ? 1 : 0, pointerEvents: showCta ? 'auto' : 'none', transition: 'opacity 0.22s ease' }}
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
              {activeTab === 'unit'
                ? `${selected.size} theme${selected.size !== 1 ? 's' : ''} selected · up to ${Math.min(totalSelectedWords, 20)} questions`
                : `${selectedLetters.size} letter${selectedLetters.size !== 1 ? 's' : ''} · up to ${Math.min(totalLetterWords, 20)} questions`}
            </span>
          </div>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <path d="M4 11h14M13 6l5 5-5 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.button>
      </div>
    </div>
  );
}

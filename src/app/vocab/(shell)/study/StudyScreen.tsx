'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ChevronDown, Lock, CheckCircle, Clock, BookOpen, Circle } from 'lucide-react';
import type { UnitWithThemes, ThemeWithStatus, ThemeStatus } from '@/lib/vocab/study-data';
import type { LetterSummary } from '@/lib/vocab/letter-data';
import type { ReviewData } from '@/lib/vocab/review-data';
import AllWordsReviewedScreen from '@/components/vocab/AllWordsReviewedScreen';
import LockedUnitOverlay from '@/components/vocab/LockedUnitOverlay';
import ReviewTab from './ReviewTab';

interface Props {
  data: {
    units:         UnitWithThemes[];
    phase:         number;
    resumeThemeId: number | null;
    totalPoints:   number;
    masteredWords: number;
    totalWords:    number;
  };
  letterIndex: LetterSummary[];
  reviewData:  ReviewData;
}

// ─── Letter grid card ─────────────────────────────────────────────────────────

const MASTERY_SEGMENT_COLORS = {
  familiar: '#38bdf8',
  strong:   '#2ecc71',
  mastered: '#e63946',
};

function LetterCard({ summary }: { summary: LetterSummary }) {
  const router    = useRouter();
  const masteryPct = summary.wordCount > 0
    ? summary.familiarPlusCount / summary.wordCount
    : 0;
  const masteryPctInt = Math.round(masteryPct * 100);

  // Progress bar color: red → gold based on completion
  const barColor = masteryPct >= 0.8
    ? 'var(--color-lx-accent-gold)'
    : masteryPct >= 0.4
      ? '#f97316'
      : 'var(--color-lx-accent-red)';

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      whileTap={{ scale: 0.95 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      onClick={() => router.push(`/vocab/study/letter/${summary.letter}`)}
      style={{
        background: 'var(--color-lx-surface)',
        border: '1px solid var(--color-lx-border)',
        borderRadius: 16,
        padding: '0.875rem 0.75rem 0.75rem',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem',
        position: 'relative',
        width: '100%',
      }}
    >
      {/* Letter */}
      <span style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: '2rem', fontWeight: 700,
        color: 'var(--color-lx-text-primary)',
        lineHeight: 1,
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

// ─── Tab switcher ─────────────────────────────────────────────────────────────

type StudyTab = 'theme' | 'letter' | 'review';

function TabSwitcher({
  active, onChange, reviewCount,
}: {
  active: StudyTab;
  onChange: (t: StudyTab) => void;
  reviewCount: number;
}) {
  const tabs: { id: StudyTab; label: string }[] = [
    { id: 'theme',  label: 'By Theme' },
    { id: 'letter', label: 'By Letter' },
    { id: 'review', label: 'Review' },
  ];

  return (
    <div style={{
      display: 'flex',
      gap: 0,
      borderBottom: '1px solid var(--color-lx-border)',
      marginBottom: '1rem',
      position: 'relative',
    }}>
      {tabs.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          style={{
            padding: '0.5rem 1.25rem',
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: "'Sora', sans-serif",
            fontSize: '0.8125rem', fontWeight: 600,
            color: active === id ? 'var(--color-lx-text-primary)' : 'var(--color-lx-text-muted)',
            position: 'relative',
            display: 'flex', alignItems: 'center', gap: '0.35rem',
          }}
        >
          {label}
          {/* Count badge on Review tab */}
          {id === 'review' && reviewCount > 0 && (
            <span style={{
              fontFamily: "'Sora', sans-serif",
              fontSize: '0.55rem', fontWeight: 700,
              background: 'var(--color-lx-accent-red)',
              color: '#fff',
              padding: '0.1rem 0.35rem',
              borderRadius: 99,
              lineHeight: 1.6,
              minWidth: 16,
              textAlign: 'center',
            }}>
              {reviewCount}
            </span>
          )}
          {active === id && (
            <motion.div
              layoutId="study-tab-indicator"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              style={{
                position: 'absolute', bottom: -1, left: 0, right: 0,
                height: 2, background: 'var(--color-lx-accent-red)',
                borderRadius: 1,
              }}
            />
          )}
        </button>
      ))}
    </div>
  );
}

export default function StudyScreen({ data, letterIndex, reviewData }: Props) {
  const [openUnitId, setOpenUnitId] = useState<number | null>(
    data.units[0]?.id ?? null,
  );
  const [activeTab, setActiveTab] = useState<StudyTab>('theme');

  const reviewCount = reviewData.dueWords.length + reviewData.weakWords.length;

  // Check if all unlocked themes across all units are complete
  const allUnlockedThemes = data.units.flatMap(u => u.themes).filter(t => !t.locked);
  const allComplete = allUnlockedThemes.length > 0 &&
    allUnlockedThemes.every(t => t.status === 'complete');

  if (allComplete) {
    return (
      <AllWordsReviewedScreen
        totalWords={data.totalWords}
        masteredWords={data.masteredWords}
        totalPoints={data.totalPoints}
      />
    );
  }

  return (
    <div className="relative flex flex-col gap-4 px-5 pb-6 pt-12 md:px-8 md:pt-14">
      {/* Ambient header gradient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40"
        style={{
          background: 'linear-gradient(180deg, rgba(230,57,70,0.06) 0%, transparent 100%)',
        }}
      />

      <h1
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize:   'clamp(2rem, 4vw, 2.6rem)',
          fontWeight: 700,
          fontStyle:  'italic',
          color:      'var(--color-lx-text-primary)',
          position:   'relative',
        }}
      >
        Study
      </h1>

      {/* Tab switcher */}
      <div className="md:max-w-2xl md:w-full md:mx-auto">
        <TabSwitcher active={activeTab} onChange={setActiveTab} reviewCount={reviewCount} />
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'review' ? (
          <motion.div
            key="review-tab"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="md:max-w-2xl md:w-full md:mx-auto"
          >
            <ReviewTab reviewData={reviewData} />
          </motion.div>
        ) : activeTab === 'theme' ? (
          <motion.div
            key="theme-tab"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {data.units.length === 0 && (
              <p className="text-sm" style={{ color: 'var(--color-lx-text-secondary)' }}>
                No units available yet. Check back soon.
              </p>
            )}

            {/* On desktop: constrain accordion list to a readable max-width, centered */}
            <div className="md:max-w-2xl md:w-full md:mx-auto">
              {data.units.map((unit, i) => (
                <motion.div
                  key={unit.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, ease: [0.16, 1, 0.3, 1], duration: 0.4 }}
                  className="mb-4"
                >
                  <UnitAccordion
                    unit={unit}
                    isOpen={openUnitId === unit.id}
                    onToggle={() => setOpenUnitId(openUnitId === unit.id ? null : unit.id)}
                    resumeThemeId={data.resumeThemeId}
                  />
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="letter-tab"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="md:max-w-2xl md:w-full md:mx-auto"
          >
            {letterIndex.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-lx-text-secondary)' }}>
                No words in the library yet.
              </p>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                gap: 10,
              }}>
                {letterIndex.map((summary, i) => (
                  <motion.div
                    key={summary.letter}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, type: 'spring', stiffness: 360, damping: 28 }}
                  >
                    <LetterCard summary={summary} />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function UnitAccordion({
  unit, isOpen, onToggle, resumeThemeId,
}: {
  unit:          UnitWithThemes;
  isOpen:        boolean;
  onToggle:      () => void;
  resumeThemeId: number | null;
}) {
  const router = useRouter();

  function handleThemeTap(theme: ThemeWithStatus) {
    if (theme.locked) return;
    router.push(`/vocab/study/${theme.id}`);
  }

  // Check if the entire unit is locked (all themes are locked)
  const entireUnitLocked = unit.themes.length > 0 && unit.themes.every(t => t.locked);

  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{
        background: 'linear-gradient(135deg, var(--color-lx-surface) 0%, rgba(20,20,20,0.9) 100%)',
        border:     entireUnitLocked
          ? '1px solid rgba(201,168,76,0.18)'
          : '1px solid var(--color-lx-border)',
        position:   'relative',
      }}
    >
      {/* ── Locked unit overlay (phase-2 gate) ─────────────────── */}
      {entireUnitLocked && (
        <LockedUnitOverlay unitName={unit.name} />
      )}

      {/* Header row */}
      <button
        onClick={entireUnitLocked ? undefined : onToggle}
        className="flex w-full flex-col p-4"
        style={{
          color:   'var(--color-lx-text-primary)',
          cursor:  entireUnitLocked ? 'default' : 'pointer',
          opacity: entireUnitLocked ? 0.35 : 1,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-start gap-0.5">
            <span
              className="text-lg font-semibold"
              style={{ fontFamily: "'Sora', sans-serif" }}
            >
              {unit.name}
            </span>
            <span className="text-xs" style={{ color: 'var(--color-lx-text-muted)', fontFamily: "'Sora', sans-serif" }}>
              {unit.completePct}% complete · {unit.themes.length} themes
            </span>
          </div>
          <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.25 }}>
            <ChevronDown size={18} style={{ color: 'var(--color-lx-text-muted)' }} />
          </motion.div>
        </div>

        {/* Progress bar */}
        <div
          className="mt-3 h-1 w-full overflow-hidden rounded-full"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, var(--color-lx-accent-red) 0%, var(--color-lx-accent-gold) 100%)',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${unit.completePct}%` }}
            transition={{ duration: 0.85, ease: 'easeOut', delay: 0.1 }}
          />
        </div>
      </button>

      {/* Theme cards */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="themes"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2 px-3 pb-3">
              {unit.themes.map(theme => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  isResume={theme.id === resumeThemeId}
                  onTap={() => handleThemeTap(theme)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const STATUS_CONFIG: Record<ThemeStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  not_started:     { label: 'Not Started',     color: 'var(--color-lx-text-muted)',  bg: 'rgba(255,255,255,0.04)',       icon: <Circle size={11} /> },
  flashcards_done: { label: 'Cards Done',      color: 'var(--color-lx-warning)',     bg: 'rgba(243,156,18,0.12)',        icon: <BookOpen size={11} /> },
  quiz_pending:    { label: 'Quiz Pending',    color: 'var(--color-lx-warning)',     bg: 'rgba(243,156,18,0.12)',        icon: <Clock size={11} /> },
  complete:        { label: 'Complete',        color: 'var(--color-lx-success)',     bg: 'rgba(46,204,113,0.12)',        icon: <CheckCircle size={11} /> },
};

function ThemeCard({
  theme, isResume, onTap,
}: {
  theme:    ThemeWithStatus;
  isResume: boolean;
  onTap:    () => void;
}) {
  const cfg = STATUS_CONFIG[theme.status];

  return (
    <motion.button
      whileTap={theme.locked ? {} : { scale: 0.97 }}
      onClick={onTap}
      className="relative flex items-center justify-between overflow-hidden rounded-xl p-3 text-left"
      style={{
        background: isResume
          ? 'linear-gradient(135deg, rgba(230,57,70,0.1) 0%, rgba(230,57,70,0.03) 100%)'
          : 'var(--color-lx-elevated)',
        borderLeft:   isResume ? '3px solid var(--color-lx-accent-red)' : '3px solid transparent',
        borderTop:    '1px solid var(--color-lx-border)',
        borderRight:  '1px solid var(--color-lx-border)',
        borderBottom: '1px solid var(--color-lx-border)',
        opacity:  theme.locked ? 0.3 : 1,
        cursor:   theme.locked ? 'default' : 'pointer',
      }}
    >
      <div className="flex flex-col gap-0.5">
        <span
          className="text-sm font-semibold"
          style={{ color: 'var(--color-lx-text-primary)', fontFamily: "'Sora', sans-serif" }}
        >
          {theme.name}
        </span>
        <span className="text-xs" style={{ color: 'var(--color-lx-text-muted)', fontFamily: "'Sora', sans-serif" }}>
          {theme.wordCount} words
        </span>
        {isResume && (
          <span
            className="text-xs font-medium"
            style={{ color: 'var(--color-lx-accent-red)', fontFamily: "'Sora', sans-serif" }}
          >
            Resume →
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Status chip — bg + color only, no border */}
        <span
          className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
          style={{
            color:      cfg.color,
            background: cfg.bg,
            fontFamily: "'Sora', sans-serif",
          }}
        >
          {cfg.icon}
          {cfg.label}
        </span>

        {theme.locked && (
          <Lock size={13} style={{ color: 'var(--color-lx-text-muted)' }} />
        )}
      </div>
    </motion.button>
  );
}

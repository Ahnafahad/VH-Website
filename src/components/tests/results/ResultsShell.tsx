'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import type { ResultsPayload } from '@/lib/tests/types';
import ScorecardHero from './ScorecardHero';
import SectionLedger from './SectionLedger';
import ClassContext from './ClassContext';
import InsightsTiles from './InsightsTiles';
import QuestionReview from './QuestionReview';
import HardestStrip from './HardestStrip';
import LockedState from './LockedState';
import NoAttemptState from './NoAttemptState';

// ─── Variants ────────────────────────────────────────────────────────────────

const pageVariants: Variants = {
  hidden:  { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { type: 'spring' as const, stiffness: 60, damping: 20, staggerChildren: 0.08 },
  },
};

const sectionVariants: Variants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 80, damping: 18 } },
};

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--color-exam-base)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-16 h-16">
          <div
            className="absolute inset-0 rounded-full border-2 border-[var(--color-exam-border)]"
          />
          <div
            className="absolute inset-0 rounded-full border-2 border-t-[var(--color-exam-gold)] animate-spin"
          />
        </div>
        <p className="text-[var(--color-exam-ink-muted)] text-sm tracking-wider uppercase">
          Loading Results
        </p>
      </div>
    </div>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────

function ErrorState({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[var(--color-exam-base)] flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-full border border-[var(--color-exam-danger)]/40 bg-[var(--color-exam-danger)]/10 flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-exam-danger)" strokeWidth="1.5">
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="8" x2="12" y2="13" />
            <circle cx="12" cy="16" r="0.5" fill="var(--color-exam-danger)" />
          </svg>
        </div>
        <h2 className="text-[var(--color-exam-ink)] font-semibold mb-2">Unable to Load</h2>
        <p className="text-[var(--color-exam-ink-muted)] text-sm mb-6">{message}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2 rounded-lg bg-[var(--color-exam-maroon)] text-[var(--color-exam-ink)] text-sm font-medium hover:bg-[var(--color-exam-maroon-bright)] transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

interface Props {
  status: 'loading' | 'locked' | 'error' | 'ok';
  data: ResultsPayload | null;
  errorMsg: string;
}

export default function ResultsShell({ status, data, errorMsg }: Props) {
  if (status === 'loading') return <LoadingSkeleton />;
  if (status === 'locked')  return <LockedState />;
  if (status === 'error')   return <ErrorState message={errorMsg} />;
  if (!data)                return <LoadingSkeleton />;

  const { me, classStats, questionAnalytics, sections, answerKey, test } = data;

  return (
    <div className="min-h-screen bg-[var(--color-exam-base)] text-[var(--color-exam-ink)]">
      <AnimatePresence>
        <motion.div
          key="results"
          variants={pageVariants}
          initial="hidden"
          animate="visible"
          className="max-w-4xl mx-auto px-4 sm:px-6 pb-24 pt-8"
        >
          {/* ── 1. Scorecard Hero ─────────────────────────────────────────── */}
          <motion.div variants={sectionVariants}>
            <ScorecardHero me={me} test={test} classStats={classStats} />
          </motion.div>

          {/* ── No attempt notice (class stats still shown below) ─────────── */}
          {me === null && (
            <motion.div variants={sectionVariants} className="mt-8">
              <NoAttemptState />
            </motion.div>
          )}

          {/* ── 2. Section Ledger ─────────────────────────────────────────── */}
          {me !== null && me.sections.length > 0 && (
            <motion.div variants={sectionVariants} className="mt-10">
              <SectionLedger sections={me.sections} />
            </motion.div>
          )}

          {/* ── 3. Class Context ──────────────────────────────────────────── */}
          <motion.div variants={sectionVariants} className="mt-10">
            <ClassContext classStats={classStats} myScore={me?.totalScore ?? null} test={test} />
          </motion.div>

          {/* ── 4. Insights ───────────────────────────────────────────────── */}
          {me !== null && (
            <motion.div variants={sectionVariants} className="mt-10">
              <InsightsTiles me={me} test={test} />
            </motion.div>
          )}

          {/* ── 5. Hardest Questions strip ────────────────────────────────── */}
          <motion.div variants={sectionVariants} className="mt-10">
            <HardestStrip
              sections={sections}
              questionAnalytics={questionAnalytics}
              responses={me?.responses ?? {}}
              answerKey={answerKey}
            />
          </motion.div>

          {/* ── 6. Question Review ────────────────────────────────────────── */}
          <motion.div variants={sectionVariants} className="mt-10">
            <QuestionReview
              sections={sections}
              responses={me?.responses ?? {}}
              answerKey={answerKey}
              questionAnalytics={questionAnalytics}
            />
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

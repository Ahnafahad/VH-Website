'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { useRouter, notFound } from 'next/navigation';
import Link from 'next/link';
import { motion, Variants } from 'framer-motion';
import { Clock, MonitorPlay, FileText } from 'lucide-react';
import type {
  TestListEntry,
  TestListWindow,
  WindowState,
  TestMode,
  StartResponse,
} from '@/lib/tests/types';
import RulesScreen from '@/components/tests/RulesScreen';

const VALID_BUCKET_SLUGS = new Set(['iba', 'du-fbs']);

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const stateBadge: Record<WindowState, { label: string; className: string }> = {
  upcoming: { label: 'Upcoming', className: 'text-exam-ink-faint border-exam-border bg-exam-elevated' },
  open: { label: 'Open now', className: 'text-exam-success border-exam-success/30 bg-exam-success/10' },
  closed: { label: 'Closed', className: 'text-exam-ink-faint border-exam-border bg-exam-elevated' },
};

const modeCopy: Record<TestMode, { label: string; cta: string; icon: typeof MonitorPlay }> = {
  online: { label: 'Online', cta: 'Take online', icon: MonitorPlay },
  offline: { label: 'Offline entry', cta: 'Enter offline answers', icon: FileText },
};

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 260, damping: 24 } },
};

type ErrorCode = 'WINDOW_NOT_OPEN' | 'ATTEMPT_BANNED' | 'ALREADY_SUBMITTED' | 'MODE_LOCKED' | 'UNKNOWN';

const errorMessages: Record<ErrorCode, string> = {
  WINDOW_NOT_OPEN: 'This window is not currently open. Please wait until it opens.',
  ATTEMPT_BANNED: 'You have been banned from this test. Contact an admin to appeal.',
  ALREADY_SUBMITTED: 'You have already submitted this test.',
  MODE_LOCKED: 'You already started this test in a different mode.',
  UNKNOWN: 'Something went wrong. Please try again.',
};

interface PageProps {
  params: Promise<{ bucket: string; slug: string }>;
}

export default function TestDetailPage({ params }: PageProps) {
  const { bucket: bucketSlug, slug } = use(params);

  if (!VALID_BUCKET_SLUGS.has(bucketSlug)) notFound();

  const router = useRouter();

  const [test, setTest] = useState<TestListEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  // Rules screen state: which window are we starting?
  const [rulesWindow, setRulesWindow] = useState<TestListWindow | null>(null);
  const [startLoading, setStartLoading] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/tests')
      .then(r => r.json())
      .then((data: { tests: TestListEntry[] }) => {
        const found = data.tests.find(t => t.slug === slug);
        if (!found) setFetchError(true);
        else setTest(found);
        setLoading(false);
      })
      .catch(() => {
        setFetchError(true);
        setLoading(false);
      });
  }, [slug]);

  const handleStartClick = useCallback((window: TestListWindow) => {
    setStartError(null);
    setRulesWindow(window);
  }, []);

  const handleAcknowledge = useCallback(async () => {
    if (!rulesWindow) return;
    setStartLoading(true);
    setStartError(null);
    try {
      const res = await fetch(`/api/tests/${slug}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ windowId: rulesWindow.id }),
      });
      if (res.ok) {
        const data: StartResponse = await res.json();
        void data; // deadline is returned but timer lives on the take page
        router.push(`/tests/${bucketSlug}/${slug}/take`);
        return;
      }
      const body: { error: string; code?: string } = await res.json();
      const code = (body.code ?? 'UNKNOWN') as ErrorCode;
      setStartError(errorMessages[code] ?? errorMessages.UNKNOWN);
      setRulesWindow(null);
    } catch {
      setStartError(errorMessages.UNKNOWN);
      setRulesWindow(null);
    } finally {
      setStartLoading(false);
    }
  }, [rulesWindow, slug, bucketSlug, router]);

  // Show rules screen when a window is selected
  if (rulesWindow) {
    return (
      <RulesScreen
        testTitle={test?.title ?? ''}
        mode={rulesWindow.mode}
        onAcknowledge={handleAcknowledge}
        isLoading={startLoading}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-exam-base flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-exam-gold/30 border-t-exam-gold animate-spin" />
      </div>
    );
  }

  if (fetchError || !test) {
    return (
      <div className="min-h-screen bg-exam-base flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-exam-danger text-lg mb-2">Test not found</p>
          <Link href="/tests" className="text-exam-ink-muted text-sm hover:text-exam-ink">← Back to Tests</Link>
        </div>
      </div>
    );
  }

  const attempt = test.attempt;
  const hasInProgress = attempt?.status === 'in_progress';
  const hasSubmitted = attempt?.status === 'submitted';
  const isBanned = attempt?.status === 'banned';

  return (
    <main className="min-h-screen bg-exam-base text-exam-ink">
      <div className="border-b border-exam-border bg-exam-surface">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Link href={`/tests/${bucketSlug}`} className="text-exam-ink-faint text-xs hover:text-exam-ink transition-colors mb-4 inline-flex items-center gap-1">
            ← {bucketSlug === 'iba' ? 'IBA' : 'DU FBS'} Tests
          </Link>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-exam-ink mt-2">
            {test.title}
          </h1>
          {test.description && (
            <p className="text-exam-ink-muted text-sm leading-relaxed mt-2 max-w-lg">{test.description}</p>
          )}
          <div className="flex gap-4 mt-4 text-xs text-exam-ink-faint">
            <span>{test.totalQuestions} questions</span>
            <span>·</span>
            <span>{test.totalMarks} marks</span>
          </div>
          {test.syllabus && (
            <div className="mt-5 bg-exam-elevated border border-exam-border rounded-xl px-5 py-4">
              <p className="text-exam-ink-faint text-xs uppercase tracking-widest mb-2">Syllabus</p>
              <p className="text-exam-ink-muted text-sm leading-relaxed whitespace-pre-wrap">{test.syllabus}</p>
            </div>
          )}
        </div>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-2xl mx-auto px-4 py-8 space-y-6"
      >
        {/* Attempt status banner */}
        {isBanned && (
          <div className="bg-exam-danger/10 border border-exam-danger/30 rounded-xl px-5 py-4 text-exam-danger text-sm">
            You have been banned from this test. Contact an admin to appeal.
          </div>
        )}
        {hasSubmitted && (
          <div className="bg-exam-success/10 border border-exam-success/30 rounded-xl px-5 py-4 text-exam-success text-sm flex items-center justify-between gap-4">
            <span>You have already submitted this test.</span>
            {test.resultsAvailable && (
              <Link href={`/tests/${bucketSlug}/${slug}/results`} className="underline text-xs">
                View results →
              </Link>
            )}
          </div>
        )}
        {hasInProgress && (
          <div className="bg-exam-warning/10 border border-exam-warning/30 rounded-xl px-5 py-4 text-exam-warning text-sm flex items-center justify-between gap-4">
            <span>You have an in-progress attempt.</span>
            <Link href={`/tests/${bucketSlug}/${slug}/take`} className="underline text-xs">
              Resume →
            </Link>
          </div>
        )}

        {/* Start error */}
        {startError && (
          <div className="bg-exam-danger/10 border border-exam-danger/30 rounded-xl px-5 py-4 text-exam-danger text-sm">
            {startError}
          </div>
        )}

        {/* Windows */}
        <div>
          <h2 className="text-exam-ink-faint text-xs uppercase tracking-widest mb-3">Exam Windows</h2>
          <div className="space-y-3">
            {test.windows.length === 0 && (
              <p className="text-exam-ink-faint text-sm">No windows scheduled yet.</p>
            )}
            {test.windows.map(w => {
              const badge = stateBadge[w.state];
              const mode = modeCopy[w.mode];
              const ModeIcon = mode.icon;
              const canStart = w.state === 'open' && !hasSubmitted && !isBanned;

              return (
                <div
                  key={w.id}
                  className="bg-exam-surface border border-exam-border rounded-xl p-5"
                >
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    {/* Mode badge */}
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-exam-elevated border border-exam-border text-exam-ink-muted text-xs">
                      <ModeIcon className="w-3.5 h-3.5" />
                      {mode.label}
                    </span>
                    {/* State chip */}
                    <span className={`px-2.5 py-1 rounded-full border text-xs font-medium ${badge.className}`}>
                      {badge.label}
                    </span>
                    {w.durationMinutes && (
                      <span className="text-exam-ink-faint text-xs">{w.durationMinutes} min</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-exam-ink-muted text-sm mb-4">
                    <Clock className="w-4 h-4 flex-shrink-0" />
                    <span>{formatTime(w.opensAt)}</span>
                    <span className="text-exam-ink-faint">–</span>
                    <span>{formatTime(w.closesAt)}</span>
                  </div>

                  {canStart && !hasInProgress && (
                    <motion.button
                      onClick={() => handleStartClick(w)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      transition={{ type: 'spring' as const, stiffness: 400, damping: 22 }}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-exam-maroon hover:bg-exam-maroon-bright
                        text-exam-ink text-sm font-medium transition-colors"
                    >
                      <ModeIcon className="w-3.5 h-3.5" />
                      {mode.cta}
                    </motion.button>
                  )}

                  {canStart && hasInProgress && (
                    <Link
                      href={`/tests/${bucketSlug}/${slug}/take`}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-exam-maroon hover:bg-exam-maroon-bright
                        text-exam-ink text-sm font-medium transition-colors"
                    >
                      Resume Exam
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </main>
  );
}

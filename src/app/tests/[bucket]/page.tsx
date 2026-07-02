'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { use } from 'react';
import { motion, Variants } from 'framer-motion';
import { Clock, MonitorPlay, FileText, CheckCircle, BarChart2 } from 'lucide-react';
import type { TestListEntry, TestListWindow, TestBucket, WindowState } from '@/lib/tests/types';
import { BUCKET_LABELS } from '@/lib/tests/types';

// Validate and normalise URL segment to API bucket value
const VALID_BUCKETS: Record<string, TestBucket> = {
  iba: 'iba',
  'du-fbs': 'du_fbs',
};

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const stateBadge: Record<WindowState, { label: string; className: string }> = {
  upcoming: {
    label: 'Upcoming',
    className: 'bg-exam-elevated border-exam-border text-exam-ink-faint',
  },
  open: {
    label: 'Open',
    className: 'bg-exam-success/10 border-exam-success/30 text-exam-success',
  },
  closed: {
    label: 'Closed',
    className: 'bg-exam-elevated border-exam-border text-exam-ink-faint',
  },
};

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 280, damping: 26 } },
};

function WindowRow({ w }: { w: TestListWindow }) {
  const badge = stateBadge[w.state];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2 border-t border-exam-border first:border-t-0">
      {/* Mode badge */}
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-exam-elevated border border-exam-border text-exam-ink-faint text-xs">
        {w.mode === 'online' ? <MonitorPlay className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
        {w.mode === 'online' ? 'Online' : 'Offline Entry'}
      </span>

      {/* Times */}
      <span className="text-exam-ink-faint text-xs">
        <Clock className="inline w-3 h-3 mr-1" />
        {formatTime(w.opensAt)} – {formatTime(w.closesAt)}
      </span>

      {w.durationMinutes && (
        <span className="text-exam-ink-faint text-xs">{w.durationMinutes} min</span>
      )}

      {/* State chip */}
      <span className={`ml-auto px-2 py-0.5 rounded-full border text-xs font-medium ${badge.className}`}>
        {badge.label}
      </span>
    </div>
  );
}

function TestCard({ test, bucketSlug }: { test: TestListEntry; bucketSlug: string }) {
  const attempt = test.attempt;
  const hasInProgress = attempt?.status === 'in_progress';
  const hasSubmitted = attempt?.status === 'submitted';
  const anyOpen = test.windows.some(w => w.state === 'open');

  return (
    <motion.div
      variants={cardVariants}
      className="bg-exam-surface border border-exam-border rounded-2xl overflow-hidden"
    >
      {/* Card header */}
      <div className="px-5 pt-5 pb-4 border-b border-exam-border">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-exam-ink font-semibold text-base leading-snug">{test.title}</h2>
            {test.description && (
              <p className="text-exam-ink-muted text-xs leading-relaxed mt-1 line-clamp-2">{test.description}</p>
            )}
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-exam-ink text-sm font-bold tabular-nums">{test.totalQuestions} Q</p>
            <p className="text-exam-ink-faint text-xs">{test.totalMarks} marks</p>
          </div>
        </div>
      </div>

      {/* Windows */}
      <div className="px-5 py-3">
        {test.windows.length === 0 ? (
          <p className="text-exam-ink-faint text-xs py-1">No windows scheduled yet.</p>
        ) : (
          <div>
            {test.windows.map(w => <WindowRow key={w.id} w={w} />)}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-5 pb-5 pt-2 flex flex-wrap items-center gap-2">
        {hasSubmitted && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-exam-success/10 border border-exam-success/20 text-exam-success text-xs font-medium">
            <CheckCircle className="w-3.5 h-3.5" />
            Submitted ✓
          </span>
        )}

        {hasInProgress && (
          <Link
            href={`/tests/${bucketSlug}/${test.slug}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-exam-maroon hover:bg-exam-maroon-bright
              text-exam-ink text-sm font-medium transition-colors"
          >
            <MonitorPlay className="w-3.5 h-3.5" />
            Resume
          </Link>
        )}

        {!hasInProgress && !hasSubmitted && anyOpen && (
          <Link
            href={`/tests/${bucketSlug}/${test.slug}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-exam-maroon hover:bg-exam-maroon-bright
              text-exam-ink text-sm font-medium transition-colors"
          >
            Start Test
          </Link>
        )}

        {!hasInProgress && !hasSubmitted && !anyOpen && (
          <Link
            href={`/tests/${bucketSlug}/${test.slug}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-exam-elevated border border-exam-border
              text-exam-ink-muted hover:text-exam-ink text-sm font-medium transition-colors"
          >
            View Details
          </Link>
        )}

        {test.resultsAvailable && (
          <Link
            href={`/tests/${bucketSlug}/${test.slug}/results`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-exam-gold/40
              text-exam-gold hover:bg-exam-gold/5 text-sm font-medium transition-colors"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            View Results
          </Link>
        )}
      </div>
    </motion.div>
  );
}

interface PageProps {
  params: Promise<{ bucket: string }>;
}

export default function BucketListPage({ params }: PageProps) {
  const { bucket: bucketSlug } = use(params);
  const apiBucket = VALID_BUCKETS[bucketSlug];

  if (!apiBucket) notFound();

  const [tests, setTests] = useState<TestListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/tests')
      .then(r => r.json())
      .then((data: { tests: TestListEntry[] }) => {
        setTests(data.tests.filter(t => t.bucket === apiBucket));
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load tests. Please refresh.');
        setLoading(false);
      });
  }, [apiBucket]);

  const bucketLabel = BUCKET_LABELS[apiBucket];

  return (
    <main className="min-h-screen bg-exam-base text-exam-ink">
      {/* Masthead */}
      <div className="border-b border-exam-border bg-exam-surface">
        <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
          <Link href="/tests" className="text-exam-ink-faint text-xs hover:text-exam-ink transition-colors mb-4 inline-flex items-center gap-1">
            ← All Tests
          </Link>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-exam-ink mt-2">
            {bucketLabel} Mock Tests
          </h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-exam-surface border border-exam-border rounded-2xl h-40 animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <div className="bg-exam-danger/10 border border-exam-danger/30 rounded-xl px-5 py-4 text-exam-danger text-sm">
            {error}
          </div>
        )}

        {!loading && !error && tests.length === 0 && (
          <div className="text-center py-16">
            <p className="text-exam-ink-faint text-lg font-serif mb-2">No tests available yet</p>
            <p className="text-exam-ink-faint text-sm">Check back soon — tests will appear here when published.</p>
          </div>
        )}

        {!loading && !error && tests.length > 0 && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-4"
          >
            {tests.map(t => <TestCard key={t.id} test={t} bucketSlug={bucketSlug} />)}
          </motion.div>
        )}
      </div>
    </main>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { Sparkles, Trophy, GraduationCap, ArrowUpRight, Award } from 'lucide-react';
import type { ResultsPayload } from '@/lib/tests/types';
import ResultsShell from '@/components/tests/results/ResultsShell';
import { googleSignIn } from '@/lib/native-google-signin';

/* ------------------------------------------------------------------ */
/*  API types                                                         */
/* ------------------------------------------------------------------ */

interface LeaderboardRow {
  rank: number;
  name: string;
  score: number;
  percentage: number;
  isStaff: boolean;
}
interface BenchmarkEntry {
  name: string;
  score: number;
  percentage: number;
}
interface LeaderboardPayload {
  test: { slug: string; title: string; totalMarks: number };
  totalTakers: number;
  leaderboard: LeaderboardRow[];
  benchmark: {
    staffCount: number;
    best: number | null;
    average: number | null;
    entries: BenchmarkEntry[];
  };
}
interface DiagnosticTest {
  slug: string;
  title: string;
  totalQuestions: number;
  totalMarks: number;
  durationMinutes: number;
  windowId: number;
  attempt: { status: string; submittedAt: number | null } | null;
}

// Every diagnostic is 40 attempted questions/marks (2 compulsory English +
// 2 of 3 chosen electives, 10 each) — not the DB's 50-question full bank.
// See ATTEMPT_QUESTIONS in ../../FbsDiagnosisClient.tsx.
const ATTEMPT_QUESTIONS = 40;

type CoreStatus = 'loading' | 'locked' | 'error' | 'ok' | 'unauth';

interface Props {
  slug: string;
}

export default function DiagnosticResultsClient({ slug }: Props) {
  const { data: session, status: sessionStatus } = useSession();
  const role = session?.user?.role;
  const isStaff = role === 'admin' || role === 'super_admin' || role === 'instructor';

  const [core, setCore] = useState<ResultsPayload | null>(null);
  const [coreStatus, setCoreStatus] = useState<CoreStatus>('loading');
  const [coreError, setCoreError] = useState('');

  const [board, setBoard] = useState<LeaderboardPayload | null>(null);
  const [others, setOthers] = useState<DiagnosticTest[]>([]);

  // Core results (requires login → 401 when signed out)
  useEffect(() => {
    fetch(`/api/tests/${slug}/results`)
      .then(async (res) => {
        if (res.status === 401) {
          setCoreStatus('unauth');
          return;
        }
        if (res.status === 403) {
          const body = (await res.json()) as { code?: string };
          if (body.code === 'RESULTS_NOT_PUBLISHED') {
            setCoreStatus('locked');
            return;
          }
        }
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setCoreError(body.error ?? 'Failed to load results.');
          setCoreStatus('error');
          return;
        }
        const payload = (await res.json()) as ResultsPayload;
        setCore(payload);
        setCoreStatus('ok');
      })
      .catch(() => {
        setCoreError('Network error — please try again.');
        setCoreStatus('error');
      });
  }, [slug]);

  // Leaderboard + benchmark (public)
  useEffect(() => {
    fetch(`/api/fbs-diagnosis/${slug}/leaderboard`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: LeaderboardPayload | null) => setBoard(data))
      .catch(() => {});
  }, [slug]);

  // Other assessments
  useEffect(() => {
    fetch('/api/fbs-diagnosis')
      .then((r) => (r.ok ? r.json() : { tests: [] }))
      .then((data: { tests: DiagnosticTest[] }) =>
        setOthers((data.tests ?? []).filter((t) => t.slug !== slug)),
      )
      .catch(() => {});
  }, [slug]);

  // ── Signed-out gate ───────────────────────────────────────────────
  if (coreStatus === 'unauth') {
    return (
      <div className="min-h-screen bg-[var(--color-exam-base)] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full border border-[var(--color-exam-gold)]/40 bg-[var(--color-exam-gold)]/10 mb-5">
            <Trophy className="w-6 h-6 text-[var(--color-exam-gold)]" strokeWidth={1.5} />
          </div>
          <h2 className="text-[var(--color-exam-ink)] font-semibold text-lg mb-2">
            Sign in to view your detailed results
          </h2>
          <p className="text-[var(--color-exam-ink-muted)] text-sm mb-6">
            Your scorecard, section breakdown, and explanations are tied to your account.
          </p>
          <button
            onClick={() => googleSignIn(`/fbs-diagnosis/${slug}/results`)}
            disabled={sessionStatus === 'loading'}
            className="px-6 py-3 rounded-xl bg-[var(--color-exam-maroon)] hover:bg-[var(--color-exam-maroon-bright)] text-[var(--color-exam-ink)] text-sm font-medium transition-colors disabled:opacity-70"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  const myRank = core?.me?.rank ?? null;

  return (
    <div className="min-h-screen bg-[var(--color-exam-base)]">
      {/* Free note */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8">
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3"
          style={{
            background: 'color-mix(in srgb, var(--color-exam-gold) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-exam-gold) 24%, transparent)',
          }}
        >
          <Sparkles className="w-4 h-4 text-[var(--color-exam-gold)] shrink-0" strokeWidth={1.5} />
          <p className="text-[var(--color-exam-ink-muted)] text-sm">
            This diagnostic is <span className="text-[var(--color-exam-gold)] font-medium">completely free</span> — a snapshot to
            show you exactly where you stand. Your score is out of{' '}
            <span className="text-[var(--color-exam-gold)] font-medium">40</span>, across the 4 subjects you attempted.
          </p>
        </div>

        {isStaff && (
          <Link
            href={`/fbs-diagnosis/${slug}/take`}
            className="mt-3 inline-flex items-center gap-2 text-[var(--color-exam-gold)] hover:text-[var(--color-exam-gold-bright)] text-xs font-medium transition-colors"
          >
            <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={1.5} />
            Retake this assessment (staff only — your best score is kept)
          </Link>
        )}
      </div>

      {/* Core results scorecard (reused) */}
      <ResultsShell status={coreStatus} data={core} errorMsg={coreError} />

      {/* Diagnostic-only panels — only alongside a rendered scorecard */}
      {coreStatus === 'ok' && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-24 -mt-12 space-y-10">
          {board && <LeaderboardPanel board={board} myRank={myRank} />}
          {board && <BenchmarkPanel board={board} />}
          {others.length > 0 && <OtherAssessments others={others} isAuthed={sessionStatus === 'authenticated'} />}
          <PreRegisterCta />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LEADERBOARD                                                        */
/* ------------------------------------------------------------------ */

function LeaderboardPanel({ board, myRank }: { board: LeaderboardPayload; myRank: number | null }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <Trophy className="w-4 h-4 text-[var(--color-exam-gold)]" strokeWidth={1.5} />
        <h2 className="text-[var(--color-exam-ink-faint)] text-xs tracking-[0.18em] uppercase">
          Leaderboard · {board.totalTakers} {board.totalTakers === 1 ? 'taker' : 'takers'}
        </h2>
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--color-exam-surface)', border: '1px solid var(--color-exam-border)' }}
      >
        {board.leaderboard.length === 0 ? (
          <p className="px-5 py-6 text-[var(--color-exam-ink-muted)] text-sm">
            No entries yet — be the first on the board.
          </p>
        ) : (
          board.leaderboard.map((row) => {
            const isMe = myRank !== null && row.rank === myRank;
            const medal =
              row.rank === 1
                ? 'var(--color-exam-gold-bright)'
                : row.rank === 2
                  ? '#C0C0C0'
                  : row.rank === 3
                    ? '#CD7F32'
                    : 'var(--color-exam-ink-faint)';
            return (
              <div
                key={`${row.rank}-${row.name}`}
                className="flex items-center gap-4 px-5 py-3 border-b border-[var(--color-exam-border)] last:border-0"
                style={{
                  background: isMe
                    ? 'color-mix(in srgb, var(--color-exam-gold) 10%, transparent)'
                    : 'transparent',
                }}
              >
                <span
                  className="w-8 text-center font-bold shrink-0"
                  style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: '20px', color: medal }}
                >
                  {row.rank}
                </span>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="text-[var(--color-exam-ink)] text-sm truncate">{row.name}</span>
                  {row.isStaff && (
                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full text-[var(--color-exam-gold)] border border-[var(--color-exam-gold)]/40">
                      Staff
                    </span>
                  )}
                  {isMe && (
                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full text-[var(--color-exam-gold)] bg-[var(--color-exam-gold)]/15">
                      You
                    </span>
                  )}
                </div>
                <span className="text-[var(--color-exam-ink-muted)] text-sm shrink-0">
                  {row.score % 1 === 0 ? row.score : row.score.toFixed(2)}
                </span>
                <span className="text-[var(--color-exam-ink-faint)] text-xs w-12 text-right shrink-0">
                  {row.percentage.toFixed(0)}%
                </span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  INSTRUCTOR BENCHMARK                                               */
/* ------------------------------------------------------------------ */

function BenchmarkPanel({ board }: { board: LeaderboardPayload }) {
  const { benchmark, test } = board;
  if (benchmark.staffCount === 0) return null;

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <Award className="w-4 h-4 text-[var(--color-exam-gold)]" strokeWidth={1.5} />
        <h2 className="text-[var(--color-exam-ink-faint)] text-xs tracking-[0.18em] uppercase">
          Instructor benchmark
        </h2>
      </div>

      <div
        className="rounded-xl p-6 sm:p-8"
        style={{
          background: 'linear-gradient(135deg, var(--color-exam-surface) 0%, var(--color-exam-elevated) 100%)',
          border: '1px solid var(--color-exam-border)',
        }}
      >
        <p className="text-[var(--color-exam-ink-muted)] text-sm mb-6 max-w-lg">
          Here&rsquo;s how our instructors performed on the same paper — the bar to aim for.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
          <Stat label="Instructors" value={String(benchmark.staffCount)} />
          <Stat
            label="Best score"
            value={
              benchmark.best === null
                ? '—'
                : `${benchmark.best % 1 === 0 ? benchmark.best : benchmark.best.toFixed(1)} / ${test.totalMarks}`
            }
          />
          <Stat
            label="Average"
            value={
              benchmark.average === null
                ? '—'
                : `${benchmark.average % 1 === 0 ? benchmark.average : benchmark.average.toFixed(1)} / ${test.totalMarks}`
            }
          />
        </div>

        {benchmark.entries.length > 0 && (
          <div className="mt-6 pt-6 border-t border-[var(--color-exam-border)] space-y-2">
            {benchmark.entries.map((e) => (
              <div key={e.name} className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-exam-ink-muted)]">{e.name}</span>
                <span className="text-[var(--color-exam-ink)]">
                  {e.score % 1 === 0 ? e.score : e.score.toFixed(2)}{' '}
                  <span className="text-[var(--color-exam-ink-faint)] text-xs">({e.percentage.toFixed(0)}%)</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[var(--color-exam-ink-faint)] text-[10px] tracking-[0.2em] uppercase mb-1.5">
        {label}
      </span>
      <span
        className="text-[var(--color-exam-ink)]"
        style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: '28px', fontWeight: 600 }}
      >
        {value}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  OTHER ASSESSMENTS                                                  */
/* ------------------------------------------------------------------ */

function OtherAssessments({ others, isAuthed }: { others: DiagnosticTest[]; isAuthed: boolean }) {
  return (
    <section>
      <h2 className="text-[var(--color-exam-ink-faint)] text-xs tracking-[0.18em] uppercase mb-4">
        Try the other assessments
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {others.map((t) => {
          const submitted = t.attempt?.status === 'submitted';
          return (
            <Link
              key={t.slug}
              href="/fbs-diagnosis"
              className="group rounded-xl p-5 transition-colors"
              style={{ background: 'var(--color-exam-surface)', border: '1px solid var(--color-exam-border)' }}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--color-exam-ink)] text-sm font-medium">{t.title}</span>
                <ArrowUpRight
                  className="w-4 h-4 text-[var(--color-exam-ink-faint)] group-hover:text-[var(--color-exam-gold)] transition-colors shrink-0"
                  strokeWidth={1.5}
                />
              </div>
              <p className="text-[var(--color-exam-ink-muted)] text-xs mt-1.5">
                {ATTEMPT_QUESTIONS} questions · {t.durationMinutes} min ·{' '}
                {submitted ? 'Completed' : isAuthed ? 'Ready to start' : 'Sign in to start'}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  PRE-REGISTER CTA                                                   */
/* ------------------------------------------------------------------ */

function PreRegisterCta() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7 }}
      className="rounded-2xl p-8 sm:p-10 text-center"
      style={{
        background: 'linear-gradient(135deg, var(--color-exam-maroon) 0%, #1A0507 100%)',
        border: '1px solid var(--color-exam-border)',
      }}
    >
      <div className="inline-flex items-center gap-2 font-sans text-[10px] tracking-[0.3em] uppercase text-[var(--color-exam-gold)] mb-4">
        <GraduationCap className="w-4 h-4" strokeWidth={1.5} />
        The paid FBS course
      </div>
      <h3
        className="text-[var(--color-exam-ink)] mb-3"
        style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 'clamp(26px, 5vw, 40px)', fontWeight: 600 }}
      >
        Turn this snapshot into a strategy.
      </h3>
      <p className="text-[var(--color-exam-ink-muted)] text-sm max-w-md mx-auto mb-7">
        Our full DU FBS program starts the{' '}
        <span className="text-[var(--color-exam-gold)]">first week of August 2026</span>. Pre-register
        now to lock your seat.
      </p>
      <Link
        href="/registration"
        className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-[var(--color-exam-gold)] text-[#1A0507] text-sm font-medium tracking-[0.1em] uppercase hover:opacity-90 transition-opacity"
      >
        Pre-register
        <ArrowUpRight className="w-4 h-4" strokeWidth={1.75} />
      </Link>
    </motion.section>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'motion/react';
import {
  ArrowUpRight,
  ArrowDown,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { FlickeringGrid } from '@/components/ui/flickering-grid';
import { BorderBeam } from '@/components/ui/border-beam';
import { googleSignIn } from '@/lib/native-google-signin';

/* ------------------------------------------------------------------ */
/*  API types (GET /api/fbs-diagnosis)                                 */
/* ------------------------------------------------------------------ */

interface DiagnosticTest {
  slug: string;
  title: string;
  totalQuestions: number;
  totalMarks: number;
  durationMinutes: number;
  windowId: number;
  attempt: { status: string; submittedAt: number | null } | null;
}

const SUBJECTS = [
  'General English',
  'Advanced English',
  'Business Studies',
  'Economics',
  'Accounting',
];

/* ------------------------------------------------------------------ */
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */

export default function FbsDiagnosisClient() {
  const { status } = useSession();
  const router = useRouter();

  const [tests, setTests] = useState<DiagnosticTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    fetch('/api/fbs-diagnosis')
      .then((r) => r.json())
      .then((data: { tests: DiagnosticTest[] }) => {
        setTests(data.tests ?? []);
        setLoading(false);
      })
      .catch(() => {
        setFetchError(true);
        setLoading(false);
      });
  }, []);

  const isAuthed = status === 'authenticated';

  const handleStart = useCallback(
    (test: DiagnosticTest) => {
      if (!isAuthed) {
        void googleSignIn('/fbs-diagnosis');
        return;
      }
      // Already submitted → results
      if (test.attempt?.status === 'submitted') {
        router.push(`/fbs-diagnosis/${test.slug}/results`);
        return;
      }
      // The take page now owns subject selection + starting the attempt.
      router.push(`/fbs-diagnosis/${test.slug}/take`);
    },
    [isAuthed, router],
  );

  const featured = tests[0] ?? null;
  const featuredDone = featured?.attempt?.status === 'submitted';
  const others = featuredDone ? tests.slice(1) : [];

  return (
    <main className="bg-[#FAF5EF] text-[#1A0507]">
      <Hero />

      {/* ── Highlights strip ─────────────────────────────────────────── */}
      <section className="relative bg-[#F5EDE3] py-20 sm:py-28 overflow-hidden">
        <LedgerLines />
        <div className="relative max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="flex flex-wrap items-baseline gap-x-10 gap-y-4 pb-10 border-b border-[#1A0507]/10"
          >
            {[
              ['50', 'MCQs'],
              ['50', 'Marks'],
              ['30', 'Minutes'],
            ].map(([n, label]) => (
              <div key={label} className="flex items-baseline gap-2.5">
                <span className="font-heading font-light text-[clamp(2.5rem,6vw,4rem)] leading-none tracking-[-0.02em] text-[#1A0507]">
                  {n}
                </span>
                <span className="font-sans text-[11px] tracking-[0.25em] uppercase text-[#A86E58]">
                  {label}
                </span>
              </div>
            ))}
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="mt-10 max-w-2xl font-sans text-base sm:text-lg leading-relaxed text-[#1A0507]/65"
          >
            One focused sitting across five DU C-Unit subjects. Instant, detailed
            results with explanations — see your rank on a public leaderboard,
            benchmarked against our instructors.
          </motion.p>

          {/* Subjects list */}
          <div className="mt-12 flex flex-wrap items-center gap-3">
            <span className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#A86E58]">
              Subjects tested
            </span>
            {SUBJECTS.map((s) => (
              <span
                key={s}
                className="font-sans text-[10px] tracking-[0.15em] uppercase px-3 py-1.5 rounded-full border border-[#760F13]/25 text-[#760F13]"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Assessments ──────────────────────────────────────────────── */}
      <section className="relative bg-[#FAF5EF] py-24 sm:py-32 overflow-hidden">
        <div className="relative max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-16"
          >
            <h2 className="font-heading font-light text-[#1A0507] text-[clamp(2.2rem,6vw,4.5rem)] leading-[0.95] tracking-[-0.02em]">
              {featuredDone ? (
                <>
                  Two more papers.{' '}
                  <em className="font-extralight text-[#760F13]">Keep going.</em>
                </>
              ) : (
                <>
                  One paper.{' '}
                  <em className="font-extralight text-[#760F13]">Start here.</em>
                </>
              )}
            </h2>
          </motion.div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 rounded-full border-2 border-[#D4B094]/40 border-t-[#760F13] animate-spin" />
            </div>
          ) : fetchError ? (
            <p className="text-[#1A0507]/60 font-sans text-sm">
              Could not load the assessments. Please refresh the page.
            </p>
          ) : tests.length === 0 ? (
            <p className="text-[#1A0507]/60 font-sans text-sm">
              No diagnostic assessments are available right now. Check back soon.
            </p>
          ) : (
            <div className="space-y-8">
              {featured && (
                <FeaturedCard
                  test={featured}
                  isAuthed={isAuthed}
                  authLoading={status === 'loading'}
                  onStart={() => handleStart(featured)}
                />
              )}

              {others.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                  {others.map((t, i) => (
                    <SecondaryCard
                      key={t.slug}
                      test={t}
                      index={i + 2}
                      isAuthed={isAuthed}
                      authLoading={status === 'loading'}
                      onStart={() => handleStart(t)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Pre-register (paid course) ───────────────────────────────── */}
      <PreRegisterSection />
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  HERO                                                               */
/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="relative min-h-[88vh] bg-[#1A0507] text-[#FAF5EF] overflow-hidden flex items-center">
      <div className="absolute inset-0 opacity-[0.18]">
        <FlickeringGrid
          squareSize={3}
          gridGap={7}
          color="#D4B094"
          maxOpacity={0.35}
          flickerChance={0.08}
        />
      </div>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 55%, rgba(212,176,148,0.18), transparent 60%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence baseFrequency='0.9'/></filter><rect width='300' height='300' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="absolute top-28 left-6 sm:left-12 font-sans text-[10px] tracking-[0.3em] uppercase text-[#D4B094]/60">
        DU FBS · C-Unit
      </div>
      <div className="absolute top-28 right-6 sm:right-12 font-sans text-[10px] tracking-[0.3em] uppercase text-[#D4B094]/60">
        Diagnostic · Free
      </div>

      <div className="relative max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 w-full pt-40 pb-28">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="inline-flex items-center gap-2 rounded-full border border-[#D4B094]/40 bg-[#D4B094]/10 px-4 py-1.5 font-sans text-[11px] tracking-[0.25em] uppercase text-[#D4B094] mb-10"
        >
          <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
          Completely free
        </motion.div>

        <h1 className="font-heading text-[#FAF5EF] text-[clamp(2.6rem,8vw,6.5rem)] leading-[0.9] tracking-[-0.03em] font-light max-w-[16ch]">
          <span className="block overflow-hidden">
            <motion.span
              initial={{ y: '110%' }}
              animate={{ y: '0%' }}
              transition={{ duration: 1, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="inline-block"
            >
              The FBS
            </motion.span>
          </span>
          <span className="block overflow-hidden">
            <motion.span
              initial={{ y: '110%' }}
              animate={{ y: '0%' }}
              transition={{ duration: 1, delay: 0.34, ease: [0.22, 1, 0.36, 1] }}
              className="inline-block italic font-extralight text-[#D4B094]"
            >
              diagnostic.
            </motion.span>
          </span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="mt-12 font-sans text-[#FAF5EF]/65 text-base sm:text-lg leading-relaxed max-w-xl"
        >
          A free, 30-minute diagnostic for the DU C-Unit paper — 50 MCQs across
          five subjects. Get instant, detailed results with explanations, see
          your rank on the leaderboard, and measure yourself against our
          instructors&rsquo; benchmark.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.9 }}
          className="mt-14 flex flex-wrap items-center gap-6"
        >
          <Link href="#assessments" className="group inline-flex items-baseline gap-3">
            <span className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#D4B094]/60">
              Begin
            </span>
            <span className="relative font-heading italic text-xl sm:text-2xl font-light text-[#FAF5EF]">
              Choose your paper
              <span className="absolute left-0 -bottom-1 h-px w-0 bg-[#D4B094] transition-all duration-500 group-hover:w-full" />
            </span>
          </Link>
        </motion.div>
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 text-[#D4B094]/60">
        <span className="font-sans text-[10px] tracking-[0.3em] uppercase">Scroll</span>
        <motion.span
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ArrowDown className="w-4 h-4" strokeWidth={1.25} />
        </motion.span>
      </div>

      {/* anchor target */}
      <span id="assessments" className="absolute bottom-0" />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  CARDS                                                              */
/* ------------------------------------------------------------------ */

interface CardProps {
  test: DiagnosticTest;
  isAuthed: boolean;
  authLoading: boolean;
  onStart: () => void;
}

function ctaLabel(test: DiagnosticTest, isAuthed: boolean, authLoading: boolean): string {
  if (authLoading) return 'Loading…';
  if (!isAuthed) return 'Sign in with Google to begin';
  if (test.attempt?.status === 'submitted') return 'View results';
  return 'Start assessment';
}

function FeaturedCard({ test, isAuthed, authLoading, onStart }: CardProps) {
  const submitted = test.attempt?.status === 'submitted';
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10%' }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      className="relative bg-[#1A0507] text-[#FAF5EF] rounded-2xl overflow-hidden border border-[#D4B094]/15"
    >
      <div className="absolute inset-0 opacity-[0.12]">
        <FlickeringGrid
          squareSize={3}
          gridGap={9}
          color="#D4B094"
          maxOpacity={0.3}
          flickerChance={0.06}
        />
      </div>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 60% at 80% 30%, rgba(212,176,148,0.16), transparent 60%)',
        }}
      />

      <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 p-8 sm:p-12">
        <div className="lg:col-span-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D4B094]/40 bg-[#D4B094]/10 px-3 py-1 font-sans text-[10px] tracking-[0.25em] uppercase text-[#D4B094] mb-6">
            Start here
          </div>
          <h3 className="font-heading font-light text-[clamp(2rem,4.5vw,3.5rem)] leading-[1] tracking-[-0.02em] mb-4">
            {test.title}
          </h3>
          <p className="font-sans text-sm sm:text-base text-[#FAF5EF]/60 leading-relaxed max-w-lg">
            The full DU C-Unit experience — {test.totalQuestions} questions,{' '}
            {test.totalMarks} marks, {test.durationMinutes} minutes. Your best
            starting point.
          </p>

          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
            {[
              { k: 'Questions', v: String(test.totalQuestions) },
              { k: 'Marks', v: String(test.totalMarks) },
              { k: 'Duration', v: `${test.durationMinutes} min` },
            ].map((s) => (
              <div key={s.k} className="flex flex-col">
                <span className="font-sans text-[9px] tracking-[0.3em] uppercase text-[#D4B094] mb-1">
                  {s.k}
                </span>
                <span className="font-heading font-light text-2xl text-[#FAF5EF]">{s.v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col justify-center gap-4">
          <button
            onClick={onStart}
            className="relative group inline-flex items-center justify-center gap-3 px-8 py-5 rounded-full overflow-hidden bg-[#FAF5EF] text-[#1A0507] disabled:opacity-70"
          >
            <BorderBeam size={80} duration={8} colorFrom="#D4B094" colorTo="#760F13" />
            <span className="relative font-sans text-sm font-medium tracking-[0.12em] uppercase">
              {ctaLabel(test, isAuthed, authLoading)}
            </span>
            <ArrowUpRight
              className="relative w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              strokeWidth={1.75}
            />
          </button>
          {submitted && (
            <p className="text-center font-sans text-xs text-[#D4B094]/70">
              You&rsquo;ve completed this one — view your detailed results.
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function SecondaryCard({
  test,
  index,
  isAuthed,
  authLoading,
  onStart,
}: CardProps & { index: number }) {
  const submitted = test.attempt?.status === 'submitted';
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10%' }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      className="relative bg-[#FAF5EF] border border-[#1A0507]/10 rounded-2xl p-8 sm:p-10 overflow-hidden"
    >
      <span
        className="absolute -top-4 -right-2 font-heading italic text-[clamp(3rem,7vw,5rem)] leading-none pointer-events-none select-none font-extralight text-[#760F13]"
        style={{ opacity: 0.1 }}
      >
        0{index}
      </span>

      <div className="relative flex items-center gap-3 mb-8">
        <span className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#760F13]">
          Assessment {index}
        </span>
        <span className="flex-1 h-px bg-[#760F13]/25" />
      </div>

      <h3 className="relative font-heading font-light text-2xl sm:text-3xl tracking-[-0.01em] text-[#1A0507] mb-3">
        {test.title}
      </h3>
      <p className="relative font-sans text-sm text-[#1A0507]/55 leading-relaxed mb-8">
        {test.totalQuestions} questions · {test.totalMarks} marks · {test.durationMinutes} min
      </p>

      <button
        onClick={onStart}
        className="relative group inline-flex items-center gap-2 text-[#760F13] disabled:opacity-70"
      >
        <span className="font-sans text-sm font-medium tracking-wide">
          {ctaLabel(test, isAuthed, authLoading)}
        </span>
        <ArrowUpRight
          className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          strokeWidth={1.5}
        />
      </button>
      {submitted && (
        <p className="relative mt-3 font-sans text-xs text-[#A86E58]">Completed</p>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  PRE-REGISTER                                                       */
/* ------------------------------------------------------------------ */

function PreRegisterSection() {
  return (
    <section className="relative py-28 sm:py-40 bg-[#1A0507] text-[#FAF5EF] overflow-hidden">
      <div className="absolute inset-0 opacity-[0.12]">
        <FlickeringGrid
          squareSize={3}
          gridGap={9}
          color="#D4B094"
          maxOpacity={0.3}
          flickerChance={0.07}
        />
      </div>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 70%, rgba(212,176,148,0.22), transparent 60%)',
        }}
      />

      <div className="relative max-w-[1100px] mx-auto px-6 sm:px-10 lg:px-16 text-center">
        <div className="flex items-center justify-center gap-3 font-sans text-[11px] tracking-[0.3em] uppercase text-[#D4B094] mb-8">
          <span className="w-8 h-px bg-[#D4B094]" />
          <GraduationCap className="w-4 h-4" strokeWidth={1.5} />
          The paid FBS course
          <span className="w-8 h-px bg-[#D4B094]" />
        </div>

        <h2 className="font-heading font-light text-[clamp(2.3rem,7vw,5.5rem)] leading-[0.92] tracking-[-0.03em] max-w-[16ch] mx-auto">
          Liked the diagnostic?{' '}
          <em className="font-extralight text-[#D4B094]">Go further.</em>
        </h2>

        <p className="mt-10 font-sans text-[#FAF5EF]/65 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
          Our full DU FBS program starts the{' '}
          <span className="text-[#D4B094]">first week of August 2026</span> —
          four months of accounting-heavy, C-Unit-focused preparation with
          founder-graded mocks. Pre-register now to lock your seat.
        </p>

        <div className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-6">
          <Link
            href="/registration"
            className="relative group inline-flex items-center gap-3 px-10 py-5 rounded-full overflow-hidden bg-[#FAF5EF] text-[#1A0507]"
          >
            <BorderBeam size={80} duration={8} colorFrom="#D4B094" colorTo="#760F13" />
            <span className="relative font-sans text-sm font-medium tracking-[0.15em] uppercase">
              Pre-register
            </span>
            <ArrowUpRight
              className="relative w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              strokeWidth={1.75}
            />
          </Link>

          <Link
            href="/program#fbs"
            className="group inline-flex items-baseline gap-3 text-[#D4B094]/80 hover:text-[#D4B094] transition-colors"
          >
            <span className="font-sans text-[10px] tracking-[0.3em] uppercase">Or</span>
            <span className="relative font-heading italic text-xl font-light">
              read the prospectus
              <span className="absolute left-0 -bottom-1 h-px w-0 bg-[#D4B094] transition-all duration-500 group-hover:w-full" />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

function LedgerLines() {
  return (
    <div
      className="absolute inset-0 pointer-events-none opacity-[0.04]"
      style={{
        backgroundImage:
          'repeating-linear-gradient(0deg, transparent, transparent 39px, #1A0507 39px, #1A0507 40px)',
      }}
    />
  );
}

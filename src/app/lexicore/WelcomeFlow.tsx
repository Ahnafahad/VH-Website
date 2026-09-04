'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from 'framer-motion';
import { signIn } from 'next-auth/react';
import LivingFlashcard, { type LivingCardWord } from '@/components/vocab/LivingFlashcard';
import LSays from '@/components/vocab/onboarding/L';
import { Fade, PrimaryButton, CardStyleChips } from '@/components/vocab/onboarding/ui';
import { DEFAULT_CARD_PREFS, type CardPrefs } from '@/lib/vocab/card-prefs';
import { writeDraft, type DiagnosticAnswer } from '@/lib/vocab/onboarding/state';
import type { DiagnosticWord } from '@/lib/vocab/onboarding/diagnostic';
import { useVocabFeedback } from '@/lib/vocab/use-vocab-feedback';

type Stage = 'thesis' | 'card' | 'diagnostic' | 'read' | 'auth';

// Diagnostic runs at least DIAGNOSTIC_BASE_SECONDS (starting easy, walking
// tier-by-tier), then keeps extending — always drawing the hardest remaining
// words — until either the reader gets WRONG_CAP words wrong or the hard
// cap DIAGNOSTIC_MAX_SECONDS is hit. A reader who's simply good at this
// never gets padded with words they got right just to hit a quota.
const DIAGNOSTIC_BASE_SECONDS = 30;
const DIAGNOSTIC_MAX_SECONDS  = 60;
const WRONG_CAP               = 5;

export default function WelcomeFlow({ demoWord }: { demoWord: LivingCardWord | null }) {
  const reduce = useReducedMotion() ?? false;
  const [stage, setStage] = useState<Stage>('thesis');
  const [prefs, setPrefs] = useState<CardPrefs>(DEFAULT_CARD_PREFS);
  const [answers, setAnswers] = useState<DiagnosticAnswer[]>([]);

  // Fetch the diagnostic pool as soon as the thesis is on screen, so the
  // diagnostic run never waits on the network.
  const [pool, setPool] = useState<Record<number, DiagnosticWord[]> | null>(null);
  useEffect(() => {
    fetch('/api/vocab/onboarding/diagnostic')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.pool) setPool(d.pool); })
      .catch(() => { /* handled by the diagnostic stage's fallback */ });
  }, []);

  const weakWordIds = useMemo(
    () => answers.filter(a => !a.correct).map(a => a.wordId),
    [answers],
  );

  const finishDiagnostic = useCallback((result: DiagnosticAnswer[]) => {
    setAnswers(result);
    writeDraft({ prefs, answers: result, weakWordIds: result.filter(a => !a.correct).map(a => a.wordId) });
    setStage('read');
  }, [prefs]);

  return (
    <main
      className="flex min-h-[100dvh] w-full justify-center"
      style={{
        background: 'var(--color-lx-base)',
        paddingTop:    'calc(env(safe-area-inset-top) + 1.25rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)',
      }}
    >
      <div className="flex w-full max-w-lg flex-col px-5 md:max-w-xl lg:max-w-2xl">
        <AnimatePresence mode="wait">
          {stage === 'thesis' && (
            <Fade key="thesis" reduce={reduce} skipEntrance>
              <Thesis onNext={() => setStage('card')} />
            </Fade>
          )}

          {stage === 'card' && (
            <Fade key="card" reduce={reduce}>
              <CardStage
                word={demoWord}
                prefs={prefs}
                setPrefs={setPrefs}
                reduce={reduce}
                onNext={() => setStage('diagnostic')}
              />
            </Fade>
          )}

          {stage === 'diagnostic' && (
            <Fade key="diagnostic" reduce={reduce}>
              <Diagnostic pool={pool} onDone={finishDiagnostic} />
            </Fade>
          )}

          {stage === 'read' && (
            <Fade key="read" reduce={reduce}>
              <LRead answers={answers} weakCount={weakWordIds.length} reduce={reduce} onNext={() => setStage('auth')} />
            </Fade>
          )}

          {stage === 'auth' && (
            <Fade key="auth" reduce={reduce}>
              <AuthStage weakCount={weakWordIds.length} />
            </Fade>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

/* ─── shared bits ─────────────────────────────────────────── */



/* ─── 1. thesis ───────────────────────────────────────────── */

function Thesis({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-8 py-10">
      <h1 style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: 'clamp(2.1rem, 10vw, 3.4rem)',
        lineHeight: 1.05,
        fontWeight: 700,
        letterSpacing: '-0.02em',
        color: 'var(--color-lx-text-primary)',
        margin: 0,
      }}>
        Memorising a definition<br />isn&rsquo;t knowing<br />a word.
      </h1>

      <LSays delay={0.12}>
        Let&rsquo;s see the difference,
      </LSays>

      <div className="mt-auto">
        <PrimaryButton onClick={onNext}>Show me</PrimaryButton>
      </div>
    </div>
  );
}

/* ─── 2. the card ─────────────────────────────────────────── */

function CardStage({
  word, prefs, setPrefs, reduce, onNext,
}: {
  word: LivingCardWord | null;
  prefs: CardPrefs;
  setPrefs: (p: CardPrefs) => void;
  reduce: boolean;
  onNext: () => void;
}) {
  const [flipped, setFlipped] = useState(false);

  if (!word) {
    // Nothing to demo — don't fake a card, just move on.
    return (
      <div className="flex flex-1 flex-col justify-center gap-8">
        <LSays>Let&rsquo;s find out what you already know.</LSays>
        <PrimaryButton onClick={onNext}>Start</PrimaryButton>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-5 py-4">
      <LSays>
        {flipped ? 'Your card. Keep what helps you, drop what doesn’t.' : 'Tap the card.'}
      </LSays>

      <div className="relative w-full" style={{ minHeight: 'min(58vh, 420px)', display: 'flex' }}>
        <LivingFlashcard
          word={word}
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
            transition={{ duration: reduce ? 0.12 : 0.22, delay: reduce ? 0 : 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-3"
          >
            <CardStyleChips prefs={prefs} setPrefs={setPrefs} />

            <PrimaryButton onClick={onNext}>This is my card</PrimaryButton>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


/* ─── 3. the diagnostic read ─────────────────────────────── */

function Diagnostic({
  pool, onDone,
}: {
  pool: Record<number, DiagnosticWord[]> | null;
  onDone: (answers: DiagnosticAnswer[]) => void;
}) {
  const [tier, setTier]       = useState(1); // start easy
  const [used, setUsed]       = useState<number[]>([]);
  const [answers, setAnswers] = useState<DiagnosticAnswer[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const doneRef               = useRef(false);
  const fb                    = useVocabFeedback();

  const [pop, setPop] = useState<{ id: number } | null>(null);
  const popId = useRef(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(320);
  useLayoutEffect(() => {
    if (containerRef.current) setContainerW(containerRef.current.offsetWidth);
  }, []);

  // Keep the latest answers reachable from the timer without restarting it.
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const finish = useCallback((result: DiagnosticAnswer[]) => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone(result);
  }, [onDone]);

  useEffect(() => {
    if (!pool) return;
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [pool]);

  const wrongCount = useMemo(() => answers.filter(a => !a.correct).length, [answers]);

  useEffect(() => {
    if (!pool) return;
    if (elapsed >= DIAGNOSTIC_MAX_SECONDS || wrongCount >= WRONG_CAP) finish(answersRef.current);
  }, [elapsed, wrongCount, pool, finish]);

  // Walk toward the tier the user actually fails at: right → harder, wrong → easier.
  // Once the base window has passed, stop backing off on a correct answer —
  // always reach for the hardest remaining words, trying to surface a real miss.
  const current = useMemo<DiagnosticWord | null>(() => {
    if (!pool) return null;
    for (const t of [tier, tier + 1, tier - 1, tier + 2, tier - 2]) {
      const candidates = (pool[t] ?? []).filter(w => !used.includes(w.id));
      if (candidates.length) return candidates[0];
    }
    return null;
  }, [pool, tier, used]);

  useEffect(() => {
    if (pool && !current && !doneRef.current) finish(answersRef.current);
  }, [pool, current, finish]);

  function answer(choice: 'positive' | 'negative') {
    if (!current) return;
    const correct = choice === current.connotation;
    const next = [...answers, { wordId: current.id, correct, tier: current.tier }];
    setAnswers(next);
    setUsed(u => [...u, current.id]);
    setTier(t => (elapsed >= DIAGNOSTIC_BASE_SECONDS ? 5 : Math.min(5, Math.max(1, correct ? t + 1 : t - 1))));
    fb.play(correct ? 'correct' : 'incorrect');
    if (correct) { popId.current += 1; setPop({ id: popId.current }); }
  }

  if (!pool || !current) {
    return (
      <div className="flex flex-1 flex-col justify-center">
        <LSays>One moment.</LSays>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 py-4">
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ fontFamily: "'Sora', sans-serif", color: 'var(--color-lx-text-muted)' }}>
          does this word feel good or bad?
        </span>
        <span className="text-xs tabular-nums" style={{ fontFamily: "'Sora', sans-serif", color: 'var(--color-lx-text-muted)' }}>
          {Math.max(0, DIAGNOSTIC_MAX_SECONDS - elapsed)}s
        </span>
      </div>

      <div className="h-[2px] w-full overflow-hidden rounded-full" style={{ background: 'var(--color-lx-elevated)' }}>
        <motion.div
          animate={{ width: `${(Math.max(0, DIAGNOSTIC_MAX_SECONDS - elapsed) / DIAGNOSTIC_MAX_SECONDS) * 100}%` }}
          transition={{ duration: 1, ease: 'linear' }}
          style={{ height: '100%', background: 'var(--color-lx-accent-gold)' }}
        />
      </div>

      <div ref={containerRef} className="relative flex flex-1 items-center justify-center">
        <AnimatePresence mode="sync">
          <DiagnosticCard
            key={current.id}
            word={current}
            containerWidth={containerW}
            onCommit={answer}
          />
        </AnimatePresence>
        <AnimatePresence>
          {pop && <DiagnosticPop key={pop.id} onDone={() => setPop(null)} />}
        </AnimatePresence>
      </div>

      {/* Bad on the left, Good on the right — matches the drag directions
          above (drag right = positive/Good, drag left = negative/Bad) so the
          fallback buttons don't contradict the swipe gesture. */}
      <div className="flex gap-3">
        <ChoiceButton label="Bad"  tone="bad"  onClick={() => answer('negative')} />
        <ChoiceButton label="Good" tone="good" onClick={() => answer('positive')} />
      </div>
    </div>
  );
}

/** Same floating-confirmation language as Word Charge's own correct-answer chip. */
function DiagnosticPop({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 900);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{ opacity: 0, y: -48 }}
      transition={{ duration: 0.85, ease: 'easeOut' }}
      style={{
        position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
        zIndex: 20, pointerEvents: 'none',
        fontFamily: "'Sora', sans-serif", fontSize: '0.85rem', fontWeight: 700,
        color: 'var(--color-lx-success)',
        background: 'rgba(46,204,113,0.12)',
        border: '1px solid rgba(46,204,113,0.4)',
        borderRadius: 20, padding: '0.2rem 0.65rem',
        whiteSpace: 'nowrap',
      }}
    >
      ✓ nice read
    </motion.div>
  );
}

const DIAGNOSTIC_VELOCITY_THRESHOLD = 600;
const DIAGNOSTIC_VELOCITY_MIN_OFFSET = 60;
const DIAGNOSTIC_COMMIT_RATIO = 0.38;

function DiagnosticCard({ word, containerWidth, onCommit }: {
  word: DiagnosticWord;
  containerWidth: number;
  onCommit: (choice: 'positive' | 'negative') => void;
}) {
  const dragX = useMotionValue(0);
  const threshold = Math.max(containerWidth * DIAGNOSTIC_COMMIT_RATIO, 80);
  const rotate = useTransform(dragX, [-threshold, 0, threshold], [-8, 0, 8]);
  const [dragging, setDragging] = useState(false);
  const locked = useRef(false);

  const goodOpacity = useTransform(dragX, [0, threshold],  [0, 0.85]);
  const badOpacity  = useTransform(dragX, [-threshold, 0], [0.85, 0]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    setDragging(false);
    if (locked.current) return;
    const ox = info.offset.x;
    const vx = info.velocity.x;
    const flingCommit = Math.abs(vx) > DIAGNOSTIC_VELOCITY_THRESHOLD && Math.abs(ox) >= DIAGNOSTIC_VELOCITY_MIN_OFFSET;
    const distCommit  = Math.abs(ox) >= threshold;
    if (distCommit || flingCommit) {
      locked.current = true;
      onCommit(ox > 0 ? 'positive' : 'negative');
    }
  }

  return (
    <motion.div
      drag="x"
      dragSnapToOrigin
      dragElastic={0.6}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.12 }}
      onDragStart={() => setDragging(true)}
      onDragEnd={handleDragEnd}
      whileTap={{ cursor: 'grabbing' }}
      style={{
        x: dragX,
        rotate,
        position: 'relative',
        // Same ring-plaque artifact and sizing as the Word Charge game
        // (ChargeCard.tsx) this is ported from — same visualizer, same
        // width cap, so the pole labels (children of the dragged element,
        // so they translate with it) never get dragged past the viewport
        // edge on mobile.
        width: 'min(100%, 76vw, 42dvh)',
        aspectRatio: '1',
        margin: '0 auto',
        touchAction: 'none',
        cursor: 'grab',
        userSelect: 'none',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/lexicore-assets/games/word-charge.webp"
        alt=""
        aria-hidden
        draggable={false}
        decoding="async"
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'contain',
          userSelect: 'none', pointerEvents: 'none',
        }}
      />

      <div style={{
        position: 'absolute', inset: '27% 26% 27%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', zIndex: 2, pointerEvents: 'none',
        padding: '0 2%',
      }}>
        <p style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontStyle: 'italic',
          fontWeight: 700,
          fontSize: word.word.length > 9 ? 'clamp(1.05rem, 4.4vw, 1.4rem)'
                  : word.word.length > 6 ? 'clamp(1.2rem, 5vw, 1.55rem)'
                                         : 'clamp(1.5rem, 7vw, 2.15rem)',
          lineHeight: 1.08,
          color: 'var(--color-lx-text-primary)',
          letterSpacing: '-0.02em',
          overflowWrap: 'break-word', wordBreak: 'break-word', maxWidth: '100%',
          textShadow: '0 1px 8px rgba(0,0,0,0.7)',
          margin: 0,
        }}>
          {word.word}
        </p>
      </div>

      {dragging && (<>
        <motion.div
          aria-hidden
          style={{
            opacity: goodOpacity,
            position: 'absolute', inset: '-4%', zIndex: 3,
            borderRadius: '50%', pointerEvents: 'none',
            background: 'radial-gradient(circle at 78% 50%, rgba(244,168,40,0.38) 0%, rgba(244,168,40,0.10) 40%, transparent 68%)',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '4%',
          }}
        >
          <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-lx-accent-gold)', letterSpacing: '0.08em', textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}>
            GOOD
          </span>
        </motion.div>
        <motion.div
          aria-hidden
          style={{
            opacity: badOpacity,
            position: 'absolute', inset: '-4%', zIndex: 3,
            borderRadius: '50%', pointerEvents: 'none',
            background: 'radial-gradient(circle at 22% 50%, rgba(230,57,70,0.38) 0%, rgba(230,57,70,0.10) 40%, transparent 68%)',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: '4%',
          }}
        >
          <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-lx-accent-red)', letterSpacing: '0.08em', textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}>
            BAD
          </span>
        </motion.div>
      </>)}
    </motion.div>
  );
}

function ChoiceButton({ label, tone, onClick }: { label: string; tone: 'good' | 'bad'; onClick: () => void }) {
  const good = tone === 'good';
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 500, damping: 15 }}
      className="flex-1 rounded-2xl py-5 text-base font-semibold"
      style={{
        fontFamily: "'Sora', sans-serif",
        background: good ? 'rgba(46,204,113,0.12)' : 'rgba(230,57,70,0.12)',
        border:     `1px solid ${good ? 'rgba(46,204,113,0.35)' : 'rgba(230,57,70,0.35)'}`,
        color:      good ? 'var(--color-lx-success)' : 'var(--color-lx-accent-red)',
        boxShadow:  good ? '0 0 0 3px rgba(46,204,113,0.1)' : '0 0 0 3px rgba(230,57,70,0.1)',
      }}
    >
      {label}
    </motion.button>
  );
}

/* ─── 4. L's read ─────────────────────────────────────────── */

/** Never surface the raw internal tier number — it means nothing to a reader. */
function tierPhrase(tier: number): string {
  if (tier >= 5) return 'the hardest words we track';
  if (tier >= 4) return 'genuinely hard words';
  if (tier >= 3) return 'words that trip most people up';
  if (tier >= 2) return 'words most people already know';
  return 'the easiest words';
}

function LRead({ answers, weakCount, reduce, onNext }: {
  answers: DiagnosticAnswer[]; weakCount: number; reduce: boolean; onNext: () => void;
}) {
  const highestCleared = answers.filter(a => a.correct).reduce((m, a) => Math.max(m, a.tier), 0);
  const testedCount     = answers.length;
  const instinctiveCount = testedCount - weakCount;

  // Never manufacture a mistake. If nothing broke, say so.
  // Tier is an internal 1-5 empirical scale — never surface the raw number.
  const line = answers.length === 0
    ? 'We ran out of time before you ran out of words.'
    : weakCount === 0
      ? `Nothing broke — you cleared ${tierPhrase(highestCleared)}. We'll start where it does.`
      : highestCleared >= 4
        ? `You held up against ${tierPhrase(highestCleared)}, then ${weakCount === 1 ? 'one word' : `${weakCount} words`} stopped announcing ${weakCount === 1 ? 'itself' : 'themselves'}.`
        : `${weakCount === 1 ? 'One word' : `${weakCount} words`} slipped. That's the interesting part.`;

  const metricDelay = reduce ? 0 : 0.12;
  const lineDelay    = reduce ? 0 : metricDelay + 0.3 + 0.03;

  return (
    <div className="flex flex-1 flex-col justify-center gap-8 py-10">
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduce ? 0.1 : 0.18 }}
        className="text-xs font-semibold tracking-[0.16em]"
        style={{ fontFamily: "'Sora', sans-serif", color: 'var(--color-lx-accent-gold)' }}
      >
        L&rsquo;S READ
      </motion.span>

      {testedCount > 0 && (
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? 0.12 : 0.32, delay: metricDelay, ease: [0.22, 1, 0.36, 1] }}
          className="grid grid-cols-3 gap-3"
        >
          <ReadMetric value={testedCount} label="tested" />
          <ReadMetric value={instinctiveCount} label="instinctive" />
          <ReadMetric value={weakCount} label="worth a closer look" tone={weakCount > 0 ? 'flag' : undefined} />
        </motion.div>
      )}

      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0.12 : 0.22, delay: lineDelay, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-4"
      >
        <LSays>{line}</LSays>

        {weakCount > 0 && (
          <p style={{ fontFamily: "'Sora', sans-serif", fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--color-lx-text-muted)', margin: 0 }}>
            Next: I&rsquo;ll teach {weakCount === 1 ? 'it' : 'them'} on the card you just built, then check whether it took —
            in a sentence, not a definition.
          </p>
        )}
      </motion.div>

      <div className="mt-auto">
        <PrimaryButton onClick={onNext}>Keep going</PrimaryButton>
      </div>
    </div>
  );
}

function ReadMetric({ value, label, tone }: { value: number; label: string; tone?: 'flag' }) {
  return (
    <div
      className="flex flex-col gap-1 rounded-2xl px-4 py-3.5"
      style={{
        background: 'var(--color-lx-surface)',
        border: `1px solid ${tone === 'flag' ? 'rgba(230,57,70,0.35)' : 'var(--color-lx-border)'}`,
      }}
    >
      <span
        className="text-2xl font-bold tabular-nums"
        style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: 'var(--color-lx-text-primary)' }}
      >
        {value}
      </span>
      <span className="text-xs" style={{ fontFamily: "'Sora', sans-serif", color: 'var(--color-lx-text-muted)' }}>
        {label}
      </span>
    </div>
  );
}

/* ─── 5. the account ──────────────────────────────────────── */

function AuthStage({ weakCount }: { weakCount: number }) {
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-1 flex-col justify-center gap-8 py-10">
      <LSays>
        {weakCount > 0
          ? 'Sign in and I’ll pick those words back up where they fell.'
          : 'Sign in and we’ll start at the edge of what you know.'}
      </LSays>

      <motion.button
        onClick={() => { setBusy(true); signIn('google', { callbackUrl: '/vocab/onboarding' }); }}
        disabled={busy}
        whileTap={busy ? {} : { scale: 0.97 }}
        className="flex w-full items-center justify-center gap-3 rounded-2xl py-4 text-base font-semibold"
        style={{
          background: 'var(--color-lx-surface)',
          border: '1px solid var(--color-lx-border)',
          color: 'var(--color-lx-text-primary)',
          fontFamily: "'Sora', sans-serif",
          opacity: busy ? 0.6 : 1,
        }}
      >
        <GoogleMark />
        {busy ? 'Opening Google…' : 'Continue with Google'}
      </motion.button>

      <p className="text-center text-xs" style={{ fontFamily: "'Sora', sans-serif", color: 'var(--color-lx-text-muted)' }}>
        Save your progress and card preferences.
      </p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.2-.4-4.6H24v9.1h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.2 5.6c4.2-3.9 6.6-9.7 6.6-17z" />
      <path fill="#FBBC05" d="M10.5 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.9-6.2C1 16.3 0 20 0 24s1 7.7 2.6 10.8l7.9-6.2z" />
      <path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.3-5.5l-7.2-5.6c-2 1.4-4.6 2.2-8.1 2.2-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.2C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

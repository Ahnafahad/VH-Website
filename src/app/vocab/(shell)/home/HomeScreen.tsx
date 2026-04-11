'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import type { HomeData, MasteryBreakdown, SessionsData } from '@/lib/vocab/home-data';
import ProgressRing from '@/components/vocab/ProgressRing';
import AnimatedNumber from '@/components/vocab/AnimatedNumber';
import DeadlineBanner from '@/components/vocab/DeadlineBanner';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5)  return 'Night owl';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Mastery histogram ────────────────────────────────────────────────────────

const MASTERY_COLORS = {
  new:      '#4B5563',
  learning: '#F4A828',
  familiar: '#60a5fa',
  strong:   '#2ECC71',
  mastered: '#E63946',
};

const MASTERY_FULL: Record<string, string> = {
  new: 'New', learning: 'Learning', familiar: 'Familiar', strong: 'Strong', mastered: 'Mastered',
};

function MasteryHistogram({ breakdown }: { breakdown: MasteryBreakdown }) {
  const [active, setActive] = useState<string | null>(null);
  const total = Object.values(breakdown).reduce((s, n) => s + n, 0);
  if (total === 0) return null;

  const MAX_H = 44;
  const levels = (['new', 'learning', 'familiar', 'strong', 'mastered'] as const);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, position: 'relative' }}>
      {levels.map((lvl, i) => {
        const count = breakdown[lvl];
        if (count === 0) return null;
        const pct   = count / total;
        const h     = Math.max(5, pct * MAX_H);
        const color = MASTERY_COLORS[lvl];
        const isOn  = active === lvl;

        return (
          <div
            key={lvl}
            onMouseEnter={() => setActive(lvl)}
            onMouseLeave={() => setActive(null)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'default', position: 'relative' }}
          >
            <AnimatePresence>
              {isOn && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: 'spring' as const, stiffness: 500, damping: 30 }}
                  style={{
                    position:   'absolute',
                    bottom:     '100%',
                    left:       '50%',
                    transform:  'translateX(-50%)',
                    marginBottom: 6,
                    fontFamily: "'Sora', sans-serif",
                    fontSize:   '0.58rem',
                    color,
                    background: 'var(--color-lx-elevated)',
                    border:     `1px solid ${color}50`,
                    padding:    '2px 7px',
                    borderRadius: 4,
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    zIndex: 10,
                  }}
                >
                  {MASTERY_FULL[lvl]} · {count}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              initial={{ height: 0 }}
              animate={{ height: h }}
              transition={{ type: 'spring' as const, stiffness: 260, damping: 26, delay: 0.05 * i + 0.25 }}
              style={{
                width:        7,
                background:   color,
                borderRadius: '3px 3px 0 0',
                opacity:      active && !isOn ? 0.3 : 1,
                transition:   'opacity 0.18s ease',
              }}
            />

            <span style={{
              fontFamily:    "'Sora', sans-serif",
              fontSize:      '0.5rem',
              fontWeight:    600,
              color:         isOn ? color : 'var(--color-lx-text-muted)',
              transition:    'color 0.18s',
              letterSpacing: '0.02em',
            }}>
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Stat column ──────────────────────────────────────────────────────────────

interface StatColProps {
  label:  string;
  value:  number;
  unit?:  string;
  color?: string;
  pulse?: boolean;
  delay?: number;
  onClick?: () => void;
}

function StatCol({ label, value, unit, color, pulse, delay = 0, onClick }: StatColProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring' as const, stiffness: 320, damping: 28, delay }}
      onClick={onClick}
      whileTap={onClick ? { scale: 0.97 } : undefined}
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        gap:            4,
        cursor:         onClick ? 'pointer' : 'default',
      }}
    >
      <span style={{
        fontFamily:    "'Sora', sans-serif",
        fontSize:      '0.58rem',
        fontWeight:    600,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color:         'var(--color-lx-text-muted)',
      }}>
        {label}
      </span>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        {pulse && value > 0 ? (
          <motion.span
            animate={{ opacity: [1, 0.55, 1] }}
            transition={{ repeat: Infinity, duration: 2.6, ease: 'easeInOut' }}
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize:   '2.15rem',
              lineHeight: 1,
              fontWeight: 700,
              color:      color ?? 'var(--color-lx-text-primary)',
            }}
          >
            {value}
          </motion.span>
        ) : (
          <span style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize:   '2.15rem',
            lineHeight: 1,
            fontWeight: 700,
            color:      (color && value > 0)
              ? color
              : value === 0 && color
                ? 'var(--color-lx-success)'
                : color ?? 'var(--color-lx-text-primary)',
          }}>
            <AnimatedNumber value={value} />
          </span>
        )}
        {unit && (
          <span style={{
            fontFamily:  "'Sora', sans-serif",
            fontSize:    '0.68rem',
            color:       'var(--color-lx-text-muted)',
            paddingBottom: 4,
          }}>
            {unit}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Session row ──────────────────────────────────────────────────────────────

interface SessionRowProps {
  type:     'review' | 'review_quiz' | 'quiz' | 'learn' | 'practice';
  title:    string;
  subtitle: string;
  color:    string;
  pulse?:   boolean;
  delay:    number;
  onClick:  () => void;
}

function SessionRow({ title, subtitle, color, pulse, delay, onClick }: SessionRowProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring' as const, stiffness: 340, damping: 28, delay }}
      style={{ position: 'relative' }}
    >
      {/* SRS urgency sweep */}
      {pulse && (
        <motion.div
          animate={{ opacity: [0, 0.5, 0] }}
          transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut' }}
          style={{
            position:      'absolute',
            inset:         0,
            background:    `linear-gradient(90deg, ${color}18 0%, transparent 55%)`,
            borderRadius:  8,
            pointerEvents: 'none',
          }}
        />
      )}

      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display:    'flex',
          alignItems: 'stretch',
          width:      '100%',
          cursor:     'pointer',
          background: hovered ? `${color}0A` : 'transparent',
          border:     'none',
          padding:    0,
          borderRadius: 8,
          overflow:   'hidden',
          transition: 'background 0.2s ease',
        }}
      >
        {/* Left bar */}
        <motion.div
          animate={{
            width:   hovered ? 4 : 3,
            opacity: hovered ? 1 : 0.65,
          }}
          transition={{ type: 'spring' as const, stiffness: 500, damping: 32 }}
          style={{
            background: color,
            flexShrink: 0,
            minHeight:  52,
            transition: `box-shadow 0.2s ease`,
            boxShadow:  hovered ? `0 0 12px ${color}55` : 'none',
          }}
        />

        {/* Text */}
        <div style={{
          flex:           1,
          padding:        '11px 14px',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          gap:            12,
          textAlign:      'left',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontFamily:   "'Cormorant Garamond', Georgia, serif",
              fontSize:     '1.05rem',
              fontWeight:   600,
              fontStyle:    'italic',
              color:        'var(--color-lx-text-primary)',
              lineHeight:   1.3,
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}>
              {title}
            </p>
            <p style={{
              fontFamily:    "'Sora', sans-serif",
              fontSize:      '0.6rem',
              color:         hovered ? 'var(--color-lx-text-secondary)' : 'var(--color-lx-text-muted)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginTop:     3,
              transition:    'color 0.2s',
            }}>
              {subtitle}
            </p>
          </div>

          {/* Arrow: appears on hover */}
          <motion.div
            animate={{ opacity: hovered ? 1 : 0, x: hovered ? 0 : -5 }}
            transition={{ type: 'spring' as const, stiffness: 450, damping: 30 }}
            style={{ color, flexShrink: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>
        </div>
      </button>
    </motion.div>
  );
}

// ─── Build session rows ───────────────────────────────────────────────────────

function buildSessions(
  sessions: SessionsData,
  router: ReturnType<typeof useRouter>,
): SessionRowProps[] {
  const rows: SessionRowProps[] = [];

  if (sessions.review) {
    rows.push({
      type:     'review',
      title:    `${sessions.review.count} word${sessions.review.count !== 1 ? 's' : ''} due for review`,
      subtitle: 'SRS overdue — flashcard review',
      color:    'var(--color-lx-accent-gold)',
      pulse:    true,
      delay:    0,
      onClick:  () => router.push('/vocab/review'),
    });
    rows.push({
      type:     'review_quiz',
      title:    `Quiz — ${sessions.review.count} due word${sessions.review.count !== 1 ? 's' : ''}`,
      subtitle: 'SRS overdue — test yourself',
      color:    '#F97316',
      delay:    0.06,
      onClick:  () => router.push('/vocab/review/quiz'),
    });
  }

  if (sessions.quiz) {
    rows.push({
      type:     'quiz',
      title:    sessions.quiz.name,
      subtitle: `${sessions.quiz.wordCount} words learned — take quiz`,
      color:    'var(--color-lx-accent-red)',
      delay:    0.12,
      onClick:  () => router.push(`/vocab/study/${sessions.quiz!.themeId}/quiz`),
    });
  }

  if (sessions.learn) {
    const sub = sessions.learn.progress > 0
      ? `${sessions.learn.progress} of ${sessions.learn.wordCount} complete`
      : `${sessions.learn.wordCount} words to learn`;
    rows.push({
      type:     'learn',
      title:    sessions.learn.name,
      subtitle: sub,
      color:    '#60a5fa',
      delay:    0.18,
      onClick:  () => router.push(`/vocab/study/${sessions.learn!.themeId}`),
    });
  }

  if (sessions.practice && rows.length < 3) {
    rows.push({
      type:     'practice',
      title:    `${sessions.practice.count} weak words`,
      subtitle: 'Strengthen mastery',
      color:    'var(--color-lx-success)',
      delay:    0.24,
      onClick:  () => router.push('/vocab/practice'),
    });
  }

  return rows.slice(0, 3);
}

// ─── Thin rule ────────────────────────────────────────────────────────────────

function Rule({ delay = 0, color = 'var(--color-lx-border)' }: { delay?: number; color?: string }) {
  return (
    <motion.div
      initial={{ scaleX: 0, originX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: 0.5, ease: [0.25, 0, 0, 1], delay }}
      style={{ height: 1, background: color, width: '100%' }}
    />
  );
}

// ─── Main HomeScreen ──────────────────────────────────────────────────────────

export default function HomeScreen({ data }: { data: HomeData }) {
  const router      = useRouter();
  const firstName   = data.userName.split(' ')[0];
  const deadlinePassed = data.deadline ? new Date(data.deadline) < new Date() : false;
  const sessionRows = buildSessions(data.sessions, router);

  return (
    <div
      style={{
        padding:      '2rem 1.25rem 6rem',
        display:      'flex',
        flexDirection:'column',
        gap:          0,
        minHeight:    '100dvh',
      }}
      className="max-w-[660px] md:max-w-none lg:max-w-[940px] md:px-8 md:pt-10"
    >
      {/* ── Header ────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: 'easeOut' }}
        style={{
          display:        'flex',
          alignItems:     'flex-end',
          justifyContent: 'space-between',
          marginBottom:   '1.125rem',
        }}
      >
        <div>
          <p style={{
            fontFamily:    "'Sora', sans-serif",
            fontSize:      '0.62rem',
            fontWeight:    500,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color:         'var(--color-lx-text-muted)',
            marginBottom:  5,
          }}>
            {greeting()}
          </p>
          <h1 style={{
            fontFamily:    "'Cormorant Garamond', Georgia, serif",
            fontSize:      'clamp(2rem, 5vw, 2.75rem)',
            lineHeight:    1,
            fontWeight:    700,
            fontStyle:     'italic',
            color:         'var(--color-lx-text-primary)',
            letterSpacing: '-0.01em',
          }}>
            {firstName}
          </h1>
        </div>

        {/* Points — typographic, no pill */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          style={{
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'flex-end',
            gap:            3,
            paddingBottom:  2,
          }}
        >
          <span style={{
            fontFamily:    "'Sora', sans-serif",
            fontSize:      '0.56rem',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color:         'var(--color-lx-text-muted)',
          }}>
            Total pts
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize:   '1.75rem',
              lineHeight: 1,
              fontWeight: 700,
              color:      'var(--color-lx-accent-gold)',
            }}>
              <AnimatedNumber value={data.totalPoints} />
            </span>
            <span style={{
              fontFamily: "'Sora', sans-serif",
              fontSize:   '0.58rem',
              color:      'var(--color-lx-accent-gold)',
              opacity:    0.65,
              paddingBottom: 2,
            }}>
              pts
            </span>
          </div>
        </motion.div>
      </motion.div>

      <Rule delay={0.08} />

      {/* ── Deadline banner ──────────────────────────────────── */}
      {deadlinePassed && (
        <div style={{ marginTop: '1rem' }}>
          <DeadlineBanner />
        </div>
      )}

      {/* ── Main content grid ─────────────────────────────────── */}
      {/* Mobile: single column stack. lg+: 2-col grid [metrics | sessions] */}
      <div
        className="lg:grid lg:grid-cols-[1fr_300px] lg:items-start lg:gap-8"
        style={{ marginTop: '1.75rem' }}
      >

        {/* ── LEFT column: stats + hero ──────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

          {/* ── Stats strip ─────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <StatCol
              label="Streak"
              value={data.streakDays}
              unit="days"
              color={data.streakDays > 0 ? 'var(--color-lx-accent-red)' : undefined}
              delay={0.15}
            />
            <div style={{ width: 1, height: 40, background: 'var(--color-lx-border)', margin: '0 1.5rem' }} />
            <StatCol
              label="Due"
              value={data.dueWordsCount}
              unit="words"
              color={data.dueWordsCount > 0 ? 'var(--color-lx-accent-gold)' : 'var(--color-lx-success)'}
              pulse={data.dueWordsCount > 0}
              delay={0.2}
              onClick={data.dueWordsCount > 0 ? () => router.push('/vocab/review') : undefined}
            />
            <div style={{ width: 1, height: 40, background: 'var(--color-lx-border)', margin: '0 1.5rem' }} />
            <StatCol
              label="This week"
              value={data.weeklyPoints}
              unit="pts"
              color="var(--color-lx-accent-gold)"
              delay={0.25}
            />
          </div>

          {/* ── Hero: ring + goal + mastery ─────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, type: 'spring' as const, stiffness: 260, damping: 24 }}
            style={{
              padding:      '1.25rem 1.5rem 1.375rem',
              background:   'var(--color-lx-surface)',
              border:       '1px solid var(--color-lx-border)',
              borderRadius: 14,
              position:     'relative',
              overflow:     'hidden',
            }}
          >
            {/* Ambient glow behind ring */}
            <div aria-hidden style={{
              position:      'absolute',
              top:           '-40%',
              left:          '-5%',
              width:         '50%',
              height:        '190%',
              background:    'radial-gradient(ellipse, rgba(230,57,70,0.10) 0%, transparent 60%)',
              pointerEvents: 'none',
            }} />

            {/* Top row: ring + goal */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', position: 'relative', zIndex: 1 }}>
              <div style={{ flexShrink: 0 }}>
                <ProgressRing percentage={data.goalProgress} size={116} strokeWidth={8} />
              </div>

              <div style={{ flex: 1 }}>
                <p style={{
                  fontFamily:    "'Sora', sans-serif",
                  fontSize:      '0.57rem',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color:         'var(--color-lx-text-muted)',
                  marginBottom:  6,
                }}>
                  Today's goal
                </p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                  <span style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize:   '3rem',
                    fontWeight: 700,
                    lineHeight: 1,
                    color:      'var(--color-lx-text-primary)',
                  }}>
                    {data.dailyTarget}
                  </span>
                  <span style={{
                    fontFamily:    "'Sora', sans-serif",
                    fontSize:      '0.78rem',
                    color:         'var(--color-lx-text-secondary)',
                    paddingBottom: 5,
                  }}>
                    words
                  </span>
                </div>
                <p style={{
                  fontFamily:    "'Sora', sans-serif",
                  fontSize:      '0.62rem',
                  color:         'var(--color-lx-text-muted)',
                  marginTop:     6,
                  fontStyle:     'italic',
                }}>
                  {data.goalProgress === 0
                    ? 'Nothing reviewed yet today'
                    : `${data.goalProgress}% complete`}
                </p>
              </div>
            </div>

            {/* Bottom: mastery histogram full-width */}
            <div style={{
              position:  'relative',
              zIndex:    1,
              marginTop: '1.125rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--color-lx-border)',
              display:   'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
            }}>
              <div>
                <p style={{
                  fontFamily:    "'Sora', sans-serif",
                  fontSize:      '0.55rem',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color:         'var(--color-lx-text-muted)',
                  marginBottom:  8,
                }}>
                  Mastery
                </p>
                <MasteryHistogram breakdown={data.masteryBreakdown} />
              </div>

              {/* Total word count */}
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize:   '1.5rem',
                  fontWeight: 700,
                  lineHeight: 1,
                  color:      'var(--color-lx-text-muted)',
                }}>
                  {Object.values(data.masteryBreakdown).reduce((s, n) => s + n, 0)}
                </span>
                <p style={{
                  fontFamily:    "'Sora', sans-serif",
                  fontSize:      '0.55rem',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color:         'var(--color-lx-text-muted)',
                  marginTop:     3,
                }}>
                  total words
                </p>
              </div>
            </div>
          </motion.div>

        </div>{/* end left column */}

        {/* ── RIGHT column: sessions ─────────────────────────── */}
        {/* Mobile: sits below hero naturally. Desktop: sticky beside it. */}
        <div className="mt-7 lg:mt-0 lg:sticky lg:top-6">

          {/* Desktop card shell — invisible on mobile */}
          <div
            className="lg:rounded-[14px] lg:border lg:border-[var(--color-lx-border)] lg:bg-[var(--color-lx-surface)] lg:px-5 lg:py-5"
          >
            {sessionRows.length > 0 ? (
              <>
                {/* Section label */}
                <div style={{ marginBottom: '0.75rem' }}>
                  <p style={{
                    fontFamily:    "'Sora', sans-serif",
                    fontSize:      '0.58rem',
                    fontWeight:    600,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color:         'var(--color-lx-text-muted)',
                    display:       'inline-block',
                    paddingBottom: 5,
                    borderBottom:  '1.5px solid var(--color-lx-accent-red)',
                  }}>
                    Your Sessions
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {sessionRows.map((row, i) => (
                    <SessionRow key={row.type} {...row} delay={0.3 + i * 0.07} />
                  ))}
                </div>
              </>
            ) : (
              /* Fallback CTA when no active sessions */
              <motion.button
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.34, type: 'spring' as const, stiffness: 300, damping: 26 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push('/vocab/study')}
                style={{
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'space-between',
                  padding:        '14px 18px',
                  background:     'rgba(230,57,70,0.05)',
                  border:         '1px solid rgba(230,57,70,0.18)',
                  borderRadius:   12,
                  cursor:         'pointer',
                  width:          '100%',
                }}
              >
                <div style={{ textAlign: 'left' }}>
                  <p style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize:   '1.1rem',
                    fontWeight: 600,
                    fontStyle:  'italic',
                    color:      'var(--color-lx-text-primary)',
                    lineHeight: 1.3,
                  }}>
                    {data.lastStudyUnit ? `Continue — ${data.lastStudyUnit}` : 'Begin studying'}
                  </p>
                  <p style={{
                    fontFamily:    "'Sora', sans-serif",
                    fontSize:      '0.6rem',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color:         'var(--color-lx-text-muted)',
                    marginTop:     4,
                  }}>
                    Browse all units
                  </p>
                </div>
                <svg width="15" height="15" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                  <path
                    d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5"
                    stroke="var(--color-lx-accent-red)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </motion.button>
            )}
          </div>
        </div>{/* end right column */}

      </div>{/* end grid */}
    </div>
  );
}

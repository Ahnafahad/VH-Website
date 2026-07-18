'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
  X, RefreshCw,
  Star, Flame, Shield, Target, BookOpen, Crosshair, Zap, Layers,
  TrendingUp, Calendar, Compass, Database, Brain,
  Trophy, Award, CheckCircle2, Crown, Cpu, Sparkles,
  Infinity as InfinityIcon,
  type LucideIcon,
} from 'lucide-react';
import type { PublicProfile } from '@/lib/vocab/public-profile';

// ─── Badge icons (mirrors ProfileScreen.tsx — not exported there) ─────────────

const BADGE_ICONS: Record<string, LucideIcon> = {
  first_step:          Star,     quiz_starter:        BookOpen,
  on_a_roll:           Flame,    perfectionist:       Target,
  week_warrior:        Shield,   sharp_shooter:       Crosshair,
  unit_slayer:         Zap,      analogy_apprentice:  Layers,
  halfway_there:       TrendingUp, streak_keeper:     Calendar,
  review_regular:      RefreshCw, speed_demon:        Zap,
  leaderboard_climber: TrendingUp, vocab_explorer:    Compass,
  the_800_club:        Database,  analogy_master:     Brain,
  unit_conqueror:      Trophy,    review_legend:      Award,
  completionist:       CheckCircle2, leaderboard_legend: Crown,
  question_machine:    Cpu,       flawless_run:       Sparkles,
  word_sovereign:      Crown,     immortal:           InfinityIcon,
};

const CATEGORY_ACCENT: Record<string, string> = {
  short_term: '#E63946',
  mid_term:   '#E63946',
  long_term:  '#F4A828',
  ultimate:   '#F4A828',
};

function badgeAccent(category: string): string {
  return CATEGORY_ACCENT[category] ?? '#E63946';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

function fmtMemberSince(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// ─── Animation variants ───────────────────────────────────────────────────────

const backdropV: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.22 } },
  exit:   { opacity: 0, transition: { duration: 0.18 } },
};

const sheetMobileV: Variants = {
  hidden: { y: '100%' },
  show:   { y: 0, transition: { type: 'spring' as const, stiffness: 380, damping: 40, mass: 1 } },
  exit:   { y: '100%', transition: { type: 'spring' as const, stiffness: 380, damping: 42 } },
};

const sheetDesktopV: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  show:   { opacity: 1, scale: 1, transition: { type: 'spring' as const, stiffness: 380, damping: 40 } },
  exit:   { opacity: 0, scale: 0.95, transition: { duration: 0.18 } },
};

const reducedV: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.15 } },
  exit:   { opacity: 0, transition: { duration: 0.12 } },
};

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

// ─── Shared inline styles ─────────────────────────────────────────────────────

const ledgerLabel: React.CSSProperties = {
  fontFamily:    "'Sora', sans-serif",
  fontSize:      9,
  fontWeight:    600,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color:         'var(--color-lx-text-muted)',
};

const ledgerNumeral: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', Georgia, serif",
  fontSize:   'clamp(1.2rem, 5vw, 1.7rem)',
  fontWeight: 600,
  lineHeight: 1,
  color:      'var(--color-lx-text-primary)',
};

// ─── Skeleton (loading) ────────────────────────────────────────────────────────

function PulseBlock({ width, height, radius, reduced, style }: {
  width:    number | string;
  height:   number;
  radius:   number | string;
  reduced:  boolean;
  style?:   React.CSSProperties;
}) {
  return (
    <motion.div
      animate={reduced ? { opacity: 0.6 } : { opacity: [0.4, 0.8, 0.4] }}
      transition={reduced ? undefined : { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      style={{ width, height, borderRadius: radius, background: 'rgba(255,255,255,0.07)', ...style }}
    />
  );
}

function SkeletonBody({ reduced }: { reduced: boolean }) {
  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <PulseBlock width={56} height={56} radius="50%" reduced={reduced} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PulseBlock width="60%" height={20} radius={4} reduced={reduced} />
          <PulseBlock width="40%" height={10} radius={4} reduced={reduced} />
        </div>
      </div>

      <div style={{
        display:      'flex',
        borderTop:    '1px solid var(--color-lx-border)',
        borderBottom: '1px solid var(--color-lx-border)',
        marginBottom: 28,
      }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              flex:        1,
              padding:     '14px 12px',
              borderRight: i < 2 ? '1px solid var(--color-lx-border)' : 'none',
            }}
          >
            <PulseBlock width="70%" height={8} radius={2} reduced={reduced} style={{ marginBottom: 8 }} />
            <PulseBlock width="50%" height={22} radius={4} reduced={reduced} />
          </div>
        ))}
      </div>

      <PulseBlock width={140} height={10} radius={2} reduced={reduced} style={{ margin: '0 auto 12px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 8 }}>
        {[0, 1, 2, 3].map(i => (
          <PulseBlock key={i} width="100%" height={70} radius={4} reduced={reduced} />
        ))}
      </div>
    </div>
  );
}

// ─── Error state ───────────────────────────────────────────────────────────────

function ErrorBody({ onRetry }: { onRetry: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '32px 8px' }}>
      <p style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize:   20,
        fontStyle:  'italic',
        color:      'var(--color-lx-text-primary)',
        margin:     '0 0 8px',
      }}>
        Couldn&apos;t load profile
      </p>
      <p style={{
        fontFamily: "'Sora', sans-serif",
        fontSize:   12,
        color:      'var(--color-lx-text-muted)',
        margin:     '0 0 20px',
      }}>
        Something went wrong. Please try again.
      </p>
      <button
        onClick={onRetry}
        style={{
          display:       'flex',
          alignItems:    'center',
          gap:           6,
          padding:       '8px 16px',
          background:    'rgba(230,57,70,0.1)',
          border:        '1px solid rgba(230,57,70,0.3)',
          borderRadius:  6,
          cursor:        'pointer',
          fontFamily:    "'Sora', sans-serif",
          fontSize:      12,
          fontWeight:    600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color:         'var(--color-lx-accent-red)',
        }}
      >
        <RefreshCw size={13} />
        Retry
      </button>
    </div>
  );
}

// ─── Populated profile body ────────────────────────────────────────────────────

function ProfileBody({ profile }: { profile: PublicProfile }) {
  return (
    <div style={{ paddingTop: 8 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div
          style={{
            width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--color-lx-elevated)',
            boxShadow:  '0 0 0 2px var(--color-lx-accent-red)',
          }}
        >
          <span style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize:   '1.4rem',
            fontWeight: 700,
            fontStyle:  'italic',
            color:      'var(--color-lx-accent-red)',
          }}>
            {initials(profile.name)}
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{
            fontFamily:   "'Cormorant Garamond', Georgia, serif",
            fontSize:     22,
            fontStyle:    'italic',
            fontWeight:   600,
            color:        'var(--color-lx-text-primary)',
            margin:       '0 0 4px',
            lineHeight:   1.15,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            {profile.name}
          </h2>
          <p style={{
            fontFamily:    "'Sora', sans-serif",
            fontSize:      10,
            fontWeight:    500,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color:         'var(--color-lx-text-muted)',
            margin:        0,
          }}>
            Member since {fmtMemberSince(profile.memberSince)}
          </p>
        </div>
      </div>

      {/* Stat ledger */}
      <div style={{
        display:      'flex',
        borderTop:    '1px solid var(--color-lx-border)',
        borderBottom: '1px solid var(--color-lx-border)',
        marginBottom: 28,
      }}>
        <div style={{ flex: 1, minWidth: 0, padding: '14px 12px', borderRight: '1px solid var(--color-lx-border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={ledgerLabel}>Total Points</span>
          <span style={ledgerNumeral}>{profile.totalPoints.toLocaleString()}</span>
        </div>

        <div style={{ flex: 1, minWidth: 0, padding: '14px 12px', borderRight: '1px solid var(--color-lx-border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={ledgerLabel}>Words Mastered</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, minWidth: 0 }}>
            <span style={ledgerNumeral}>{profile.wordsMastered.toLocaleString()}</span>
            <span style={{ fontFamily: "'Sora', sans-serif", fontSize: 11, color: 'var(--color-lx-text-muted)' }}>
              / {profile.totalWords.toLocaleString()}
            </span>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={ledgerLabel}>Best Streak</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, minWidth: 0 }}>
            {profile.longestStreak > 0 && (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#F4A828" style={{ marginBottom: 2 }} aria-hidden="true">
                <path d="M12 2C6 10 9 13 9 16c0 1.7 1.3 3 3 3s3-1.3 3-3c0-1.8-1.5-3.5-1.5-6.5 0 0 2 2 2 4.5 1.1-.8 2-2.3 2-4 0-3.5-3-6-5.5-8z" />
              </svg>
            )}
            <span style={ledgerNumeral}>{profile.longestStreak}</span>
            <span style={{ fontFamily: "'Sora', sans-serif", fontSize: 11, color: 'var(--color-lx-text-muted)' }}>d</span>
          </div>
          {profile.streakDays > 0 && (
            <span style={{ fontFamily: "'Sora', sans-serif", fontSize: 9, color: 'var(--color-lx-text-muted)' }}>
              current: {profile.streakDays}d
            </span>
          )}
        </div>
      </div>

      {/* Distinctions */}
      <div>
        <p style={{
          fontFamily:    "'Sora', sans-serif",
          fontSize:      9,
          fontWeight:    600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color:         'var(--color-lx-text-muted)',
          textAlign:     'center',
          margin:        '0 0 4px',
        }}>
          — Distinctions —
        </p>
        {profile.badgesEarned > 0 && (
          <p style={{
            fontFamily: "'Sora', sans-serif",
            fontSize:   9,
            color:      'var(--color-lx-text-muted)',
            textAlign:  'center',
            margin:     '0 0 12px',
          }}>
            {profile.badgesEarned} earned
          </p>
        )}

        {profile.badges.length === 0 ? (
          <p style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize:   15,
            fontStyle:  'italic',
            color:      'var(--color-lx-text-muted)',
            textAlign:  'center',
            padding:    '16px 0',
            margin:     0,
          }}>
            No distinctions yet
          </p>
        ) : (
          <div style={{
            display:             'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))',
            gap:                 1,
            background:          'var(--color-lx-border)',
          }}>
            {profile.badges.map(badge => {
              const Icon   = BADGE_ICONS[badge.id] ?? Star;
              const accent = badgeAccent(badge.category);
              return (
                <div
                  key={badge.id}
                  style={{
                    background:    'var(--color-lx-surface)',
                    padding:       '12px 6px 10px',
                    display:       'flex',
                    flexDirection: 'column',
                    alignItems:    'center',
                    gap:           6,
                    boxShadow:     `inset 0 0 0 1px ${accent}55`,
                  }}
                >
                  <Icon
                    size={22}
                    color={accent}
                    strokeWidth={1.5}
                    style={{ filter: `drop-shadow(0 0 4px ${accent}80)` }}
                  />
                  <span style={{
                    fontFamily:      "'Sora', sans-serif",
                    fontSize:        8,
                    lineHeight:      1.3,
                    textAlign:       'center',
                    color:           'var(--color-lx-text-secondary)',
                    display:         '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow:        'hidden',
                    maxWidth:        '100%',
                  } as React.CSSProperties}>
                    {badge.name}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main sheet ────────────────────────────────────────────────────────────────

type Status = 'idle' | 'loading' | 'error' | 'loaded';

export default function PublicProfileSheet({ userId, onClose }: { userId: number | null; onClose: () => void }) {
  const open           = userId != null;
  const prefersReduced = useReducedMotion() ?? false;
  const isDesktop      = useIsDesktop();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [status, setStatus]   = useState<Status>('idle');
  const [retryTick, setRetryTick] = useState(0);
  const requestedIdRef = useRef<number | null>(null);

  const sheetRef    = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const triggerRef  = useRef<HTMLElement | null>(null);

  // Fetch profile — ignores stale responses if userId changes or the sheet closes.
  useEffect(() => {
    if (userId == null) {
      setStatus('idle');
      setProfile(null);
      return;
    }
    let cancelled = false;
    requestedIdRef.current = userId;
    setStatus('loading');
    setProfile(null);

    fetch(`/api/vocab/profile/${userId}`)
      .then(res => {
        if (!res.ok) throw new Error('Request failed');
        return res.json() as Promise<PublicProfile>;
      })
      .then(data => {
        if (cancelled || requestedIdRef.current !== userId) return;
        setProfile(data);
        setStatus('loaded');
      })
      .catch(() => {
        if (cancelled || requestedIdRef.current !== userId) return;
        setStatus('error');
      });

    return () => { cancelled = true; };
  }, [userId, retryTick]);

  // Focus management, body scroll lock, Escape-to-close, lite focus trap.
  useEffect(() => {
    if (!open) {
      triggerRef.current?.focus?.();
      return;
    }
    triggerRef.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const frame = requestAnimationFrame(() => closeBtnRef.current?.focus());

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const container = sheetRef.current;
        if (!container) return;
        const focusables = container.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0]!;
        const last  = focusables[focusables.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  const sheetVariant = prefersReduced ? reducedV : (isDesktop ? sheetDesktopV : sheetMobileV);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          variants={backdropV}
          initial="hidden"
          animate="show"
          exit="exit"
          onClick={onClose}
          style={{
            position:             'fixed',
            inset:                0,
            zIndex:               200,
            background:           'rgba(7,7,9,0.75)',
            backdropFilter:       'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display:              'flex',
            alignItems:           isDesktop ? 'center' : 'flex-end',
            justifyContent:       'center',
          }}
        >
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={profile ? `${profile.name}'s distinctions` : 'Distinctions'}
            variants={sheetVariant}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={e => e.stopPropagation()}
            style={{
              position:      'relative',
              width:         '100%',
              maxWidth:      isDesktop ? 420 : undefined,
              maxHeight:     isDesktop ? '85vh' : '90vh',
              overflowY:     'auto',
              background:    'var(--color-lx-surface)',
              border:        '1px solid var(--color-lx-border)',
              borderRadius:  isDesktop ? 16 : '16px 16px 0 0',
              padding:       '20px 20px calc(24px + env(safe-area-inset-bottom))',
            }}
          >
            {!isDesktop && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }} aria-hidden="true">
                <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-lx-border)' }} />
              </div>
            )}

            <button
              ref={closeBtnRef}
              onClick={onClose}
              aria-label="Close"
              style={{
                position:       'absolute',
                top:            4,
                right:          4,
                width:          44,
                height:         44,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                background:     'transparent',
                border:         'none',
                cursor:         'pointer',
                color:          'var(--color-lx-text-muted)',
              }}
            >
              <X size={18} />
            </button>

            {status === 'loaded' && profile ? (
              <ProfileBody profile={profile} />
            ) : status === 'error' ? (
              <ErrorBody onRetry={() => setRetryTick(t => t + 1)} />
            ) : (
              <SkeletonBody reduced={prefersReduced} />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

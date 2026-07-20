'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useVocabFeedback } from '@/lib/vocab/use-vocab-feedback';
import { useSafeNavigate } from '@/hooks/useSafeNavigate';
import { LexiIcon } from '@/components/vocab/LexiAsset';

const TABS = [
  { id: 'home',        href: '/vocab/home',        icon: 'navigation/home.svg',        label: 'Home' },
  { id: 'study',       href: '/vocab/study',       icon: 'navigation/study.svg',       label: 'Study' },
  { id: 'practice',    href: '/vocab/practice',    icon: 'navigation/practice.svg',    label: 'Practice' },
  { id: 'leaderboard', href: '/vocab/leaderboard', icon: 'navigation/leaderboard.svg', label: 'Board' },
  { id: 'games',       href: '/vocab/games',       icon: 'navigation/games.svg',       label: 'Games' },
] as const;

export default function BottomNav() {
  const pathname  = usePathname();
  const fb        = useVocabFeedback();
  const { watch } = useSafeNavigate();

  const active = TABS.find(t => pathname.startsWith(t.href))?.id ?? 'home';

  // Word Charge is a fullscreen, timed game. Its wrong/help/pause overlays live
  // inside the page's PageTransition stacking context, so a fixed nav (even at a
  // lower z-index) still paints over their controls — tapping "Continue" hit the
  // nav instead. The game has its own pause→exit and back-to-games controls, so
  // drop the nav here entirely.
  if (pathname.startsWith('/vocab/games/word-charge')) return null;

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-[430px] md:hidden"
      style={{
        background:    'rgba(26, 26, 26, 0.85)',
        backdropFilter:'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop:     '1px solid rgba(255,255,255,0.06)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex h-16 items-end justify-around pb-1 px-1">
        {TABS.map(tab => {
          const isActive = active === tab.id;

          return (
            <Link
              key={tab.id}
              href={tab.href}
              prefetch={true}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
              // min-w-[44px] min-h-[52px] satisfies the ≥44px tap-target requirement
              className="relative flex flex-col items-center justify-end gap-1 min-w-[44px] min-h-[52px] px-3 pb-1"
              onClick={() => {
                fb.play('tap');
                // Watchdog: if the soft navigation stalls (hung RSC fetch),
                // fall back to a hard navigation after a few seconds.
                watch(tab.href);
              }}
            >
              {/* Limelight spotlight: slides under active icon */}
              {isActive && (
                <motion.span
                  layoutId="limelight"
                  className="absolute inset-0 rounded-xl pointer-events-none"
                  style={{
                    background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(230,57,70,0.18) 0%, transparent 70%)',
                    boxShadow:  '0 -1px 0 0 rgba(230,57,70,0.5) inset',
                  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}

              {/* Top border highlight on active */}
              {isActive && (
                <motion.span
                  layoutId="limelight-border"
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-b-full"
                  style={{ background: 'var(--color-lx-accent-red)', boxShadow: '0 0 8px var(--color-lx-accent-red)' }}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}

              {/* Icon */}
              <motion.div
                animate={isActive ? { scale: 1, y: 0 } : { scale: 0.9, y: 2 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                whileTap={{ scale: 0.82 }}
                className="relative z-10 flex items-center justify-center"
              >
                <LexiIcon
                  path={tab.icon}
                  size={22}
                  color={isActive ? 'var(--color-lx-accent-red)' : 'var(--color-lx-text-muted)'}
                  style={{
                    filter: isActive ? 'drop-shadow(0 0 6px rgba(230,57,70,0.6))' : 'none',
                    transition: 'background-color 0.2s, filter 0.2s',
                  }}
                />
              </motion.div>

              {/* Label */}
              <motion.span
                animate={{ opacity: isActive ? 1 : 0.45, y: isActive ? 0 : 1 }}
                transition={{ duration: 0.2 }}
                className="relative z-10 text-[10px] font-medium tracking-wide"
                style={{
                  fontFamily: "'Sora', sans-serif",
                  color: isActive ? 'var(--color-lx-accent-red)' : 'var(--color-lx-text-muted)',
                  letterSpacing: '0.04em',
                }}
              >
                {tab.label}
              </motion.span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

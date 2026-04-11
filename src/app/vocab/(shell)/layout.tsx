'use client';

import { useEffect, useRef, useState } from 'react';
import BottomNav from '@/components/vocab/BottomNav';
import DesktopSidebar from '@/components/vocab/DesktopSidebar';
import PageTransition from '@/components/vocab/PageTransition';
import { BadgeQueueProvider, useBadgeQueue } from '@/lib/vocab/badges/queue';
import type { EarnedBadge } from '@/lib/vocab/badges/checker';

// Inner component — must be inside BadgeQueueProvider to call useBadgeQueue.
function VocabShellInner({ children }: { children: React.ReactNode }) {
  const { push }          = useBadgeQueue();
  const dailyLoginFired   = useRef(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('lx-theme') as 'dark' | 'light' | null;
    if (saved) setTheme(saved);
  }, []);

  // Daily login badge check — runs once per mount, guarded by ref to prevent double-fire.
  useEffect(() => {
    if (dailyLoginFired.current) return;
    dailyLoginFired.current = true;

    fetch('/api/vocab/daily-login')
      .then(res => res.ok ? res.json() : null)
      .then((data: { earnedBadges?: EarnedBadge[] } | null) => {
        if (data?.earnedBadges?.length) push(data.earnedBadges);
      })
      .catch(() => {
        // Non-critical — silently swallow errors.
      });
  }, [push]);

  return (
    <>
      {/* Google Fonts — Cormorant Garamond for words, Sora for UI */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Sora:wght@300;400;500;600;700&display=swap');
        .lx-root { font-family: 'Sora', sans-serif; }
        .lx-word { font-family: 'Cormorant Garamond', Georgia, serif; }
      `}</style>

      <div
        className={`lx-root${theme === 'light' ? ' lx-light' : ''}`}
        style={{
          minHeight:           '100dvh',
          background:          'var(--color-lx-base)',
          color:               'var(--color-lx-text-primary)',
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        {/* Subtle noise texture overlay for premium feel */}
        <div
          aria-hidden
          style={{
            position:        'fixed',
            inset:           0,
            opacity:         0.025,
            pointerEvents:   'none',
            zIndex:          0,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
            backgroundSize:  '128px 128px',
          }}
        />

        {/* Desktop sidebar — hidden on mobile, fixed on md+ */}
        <DesktopSidebar />

        {/* Content area — full width on mobile, shifted right on desktop */}
        <main
          className="relative z-10 md:ml-[220px]"
          style={{ paddingBottom: 'calc(72px + env(safe-area-inset-bottom))' }}
        >
          {/* Inner content: max 430px centered on mobile, full width on desktop */}
          <div className="mx-auto max-w-[430px] md:max-w-none md:mx-0">
            <PageTransition>{children}</PageTransition>
          </div>
        </main>

        {/* Back to main site — mobile only, floats above BottomNav */}
        <a
          href="/"
          className="md:hidden"
          style={{
            position:       'fixed',
            bottom:         'calc(72px + env(safe-area-inset-bottom) + 10px)',
            right:          14,
            zIndex:         49,
            display:        'flex',
            alignItems:     'center',
            gap:            5,
            padding:        '6px 11px',
            borderRadius:   20,
            background:     'var(--color-lx-surface)',
            border:         '1px solid var(--color-lx-border)',
            fontFamily:     "'Sora', sans-serif",
            fontSize:       '0.65rem',
            fontWeight:     500,
            letterSpacing:  '0.04em',
            color:          'var(--color-lx-text-muted)',
            textDecoration: 'none',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow:      '0 2px 12px rgba(0,0,0,0.25)',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 1L2 5l5 4" />
          </svg>
          VH Website
        </a>

        {/* Bottom nav — fixed, centered, mobile only */}
        <BottomNav />
      </div>
    </>
  );
}

export default function VocabShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <BadgeQueueProvider>
      <VocabShellInner>{children}</VocabShellInner>
    </BadgeQueueProvider>
  );
}

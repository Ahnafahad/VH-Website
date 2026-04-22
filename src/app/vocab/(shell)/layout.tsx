'use client';

import { useEffect, useRef, useState } from 'react';
import BottomNav from '@/components/vocab/BottomNav';
import DesktopSidebar from '@/components/vocab/DesktopSidebar';
import PageTransition from '@/components/vocab/PageTransition';
import InstallPrompt from '@/components/vocab/InstallPrompt';
import { DailyDossier } from '@/components/vocab/DailyDossier';
import { BadgeQueueProvider, useBadgeQueue } from '@/lib/vocab/badges/queue';
import type { EarnedBadge } from '@/lib/vocab/badges/checker';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// Inner component — must be inside BadgeQueueProvider to call useBadgeQueue.
function VocabShellInner({ children }: { children: React.ReactNode }) {
  const { push }          = useBadgeQueue();
  const dailyLoginFired   = useRef(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [dossierMessage, setDossierMessage] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('lx-theme') as 'dark' | 'light' | null;
    if (saved) setTheme(saved);
  }, []);

  // Daily login — first authenticated action of the day triggers:
  //  1. badge check (streak badges)
  //  2. L's dossier overlay (once per calendar day)
  useEffect(() => {
    if (dailyLoginFired.current) return;
    dailyLoginFired.current = true;

    fetch('/api/vocab/daily-login')
      .then(res => res.ok ? res.json() : null)
      .then(async (data: { awarded?: boolean; earnedBadges?: EarnedBadge[] } | null) => {
        if (data?.earnedBadges?.length) push(data.earnedBadges);

        if (!data?.awarded) return;

        // Day-gate the dossier so a refresh doesn't re-trigger it.
        const key = `lx-dossier-${todayKey()}`;
        if (localStorage.getItem(key) === '1') return;

        try {
          const res = await fetch('/api/vocab/daily-message');
          if (!res.ok) return;
          const msg = (await res.json()) as { message?: string };
          if (msg?.message) {
            setDossierMessage(msg.message);
            localStorage.setItem(key, '1');
          }
        } catch {
          // Non-critical — silently swallow.
        }
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

        {/* Install prompt — PWA add-to-home-screen nudge */}
        <InstallPrompt />

        {/* Bottom nav — fixed, centered, mobile only */}
        <BottomNav />

        {/* L's daily dossier — fullscreen, first authenticated action of the day */}
        {dossierMessage && (
          <DailyDossier
            message={dossierMessage}
            onDismiss={() => setDossierMessage(null)}
          />
        )}
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

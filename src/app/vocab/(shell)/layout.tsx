'use client';

import { useEffect, useRef, useState } from 'react';
import BottomNav from '@/components/vocab/BottomNav';
import DesktopSidebar from '@/components/vocab/DesktopSidebar';
import PageTransition from '@/components/vocab/PageTransition';
import InstallPrompt from '@/components/vocab/InstallPrompt';
import { DailyDossier } from '@/components/vocab/DailyDossier';
import { BadgeQueueProvider, useBadgeQueue } from '@/lib/vocab/badges/queue';
import type { EarnedBadge } from '@/lib/vocab/badges/checker';
import { unlockAudio } from '@/lib/vocab/sound';
import { ConnectionStatus } from '@/components/vocab/ConnectionStatus';
import { useLexiAccessibility } from '@/hooks/useLexiAccessibility';
import { useAnimationStallGuard } from '@/hooks/useAnimationStallGuard';
import { NativeAppBridge } from '@/components/vocab/NativeAppBridge';
import { DailyBrief } from '@/components/vocab/DailyBrief';
import { LexiTelemetry } from '@/components/vocab/LexiTelemetry';
import { AppUpdatePrompt } from '@/components/vocab/AppUpdatePrompt';
import { Capacitor } from '@capacitor/core';
import { rescheduleFromCache } from '@/lib/vocab/local-reminders';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// Inner component — must be inside BadgeQueueProvider to call useBadgeQueue.
function VocabShellInner({ children }: { children: React.ReactNode }) {
  const { push }          = useBadgeQueue();
  const dailyLoginFired   = useRef(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [dossierMessage, setDossierMessage] = useState<string | null>(null);
  const [dossierExpanded, setDossierExpanded] = useState(false);
  useLexiAccessibility();
  useAnimationStallGuard();

  useEffect(() => {
    const saved = localStorage.getItem('lx-theme') as 'dark' | 'light' | null;
    if (saved) setTheme(saved);
  }, []);

  // One-time audio context unlock on first user gesture so Web Audio works
  // once the user enables sound. Self-removing and SSR-safe (typeof window check).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => {
      unlockAudio();
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('touchstart', handler);
      window.removeEventListener('keydown',    handler);
    };
    window.addEventListener('pointerdown', handler, { once: true, passive: true });
    window.addEventListener('touchstart',  handler, { once: true, passive: true });
    window.addEventListener('keydown',     handler, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('touchstart',  handler);
      window.removeEventListener('keydown',     handler);
    };
  }, []);

  // Self-heal for stale service workers: when a new SW takes control of this
  // tab (controllerchange), reload once so the page runs against the fresh SW
  // instead of a broken pre-fix one. Guards:
  //  - only reload if the tab was ALREADY controlled (skips first-ever install)
  //  - `reloaded` flag prevents reload loops if the event fires repeatedly
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloaded = false;

    const onControllerChange = () => {
      if (!hadController || reloaded) return;
      reloaded = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  // On-device reminder scheduling — fires once on shell mount (app launch).
  // NativeAppBridge re-fires this on every resume via lexicore:resume.
  // Onboarding is complete at this point because the shell only renders after
  // the home/study/etc. redirect from the onboarding page.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void rescheduleFromCache();
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
            const introduced = localStorage.getItem('lx-dossier-introduced') === '1';
            setDossierExpanded(!introduced);
            if (!introduced) localStorage.setItem('lx-dossier-introduced', '1');
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
        .lx-root { font-family: var(--font-lexi-ui), system-ui, sans-serif; }
        .lx-word { font-family: var(--font-lexi-word), Georgia, serif; }
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
            backgroundImage: "url('/lexicore-assets/textures/charcoal-grain.svg'), url('/lexicore-assets/textures/lexicon-pattern.svg')",
            backgroundSize:  '128px 128px, 360px 360px',
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
        <ConnectionStatus />
        <NativeAppBridge />
        <LexiTelemetry />
        <AppUpdatePrompt />

        {/* Bottom nav — fixed, centered, mobile only */}
        <BottomNav />

        {/* L's daily dossier — fullscreen, first authenticated action of the day */}
        {dossierMessage && !dossierExpanded && (
          <DailyBrief
            message={dossierMessage}
            onOpen={() => setDossierExpanded(true)}
            onDismiss={() => setDossierMessage(null)}
          />
        )}
        {dossierMessage && dossierExpanded && (
          <DailyDossier
            message={dossierMessage}
            onDismiss={() => { setDossierExpanded(false); setDossierMessage(null); }}
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

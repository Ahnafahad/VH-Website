'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  trackPageview,
  trackPageExit,
  setAnalyticsUser,
  flush,
} from '@/lib/analytics/tracker';
import type { AnalyticsModule } from '@/lib/analytics/tracker';

// ─── Module derivation from path ─────────────────────────────────────────────

function moduleFromPath(path: string): AnalyticsModule {
  if (path.startsWith('/vocab'))      return 'vocab';
  if (path.startsWith('/admin'))      return 'admin';
  if (path.startsWith('/workbook'))   return 'workbook';
  if (path.startsWith('/math') || path.startsWith('/mental-math')) return 'math';
  if (path.startsWith('/accounting') || path.includes('accounting')) return 'accounting';
  if (path.startsWith('/auth'))       return 'auth';
  return 'site';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AnalyticsTracker(): null {
  const pathname = usePathname();
  const { data: session } = useSession();

  // Track current page for exit events
  const prevPathRef      = useRef<string | null>(null);
  // Visible time accumulator
  const visibleMsRef     = useRef(0);
  const visibleSinceRef  = useRef<number | null>(null);
  // Flag so we only fire the first pageview once
  const initializedRef   = useRef(false);

  // ── Sync auth state into tracker module ────────────────────────────────────
  useEffect(() => {
    if (session?.user) {
      // Session object may not have numeric id; server resolves from email.
      // Cast defensively — if future code attaches id to session.user, use it.
      const userWithId = session.user as { id?: number; email?: string };
      const numericId = typeof userWithId.id === 'number' ? userWithId.id : null;
      setAnalyticsUser(numericId, true);
    } else {
      setAnalyticsUser(null, false);
    }
  }, [session]);

  // ── Visibility helpers ─────────────────────────────────────────────────────
  const pauseTimer = () => {
    if (visibleSinceRef.current !== null) {
      visibleMsRef.current += Date.now() - visibleSinceRef.current;
      visibleSinceRef.current = null;
    }
  };

  const resumeTimer = () => {
    if (visibleSinceRef.current === null) {
      visibleSinceRef.current = Date.now();
    }
  };

  const collectVisibleMs = (): number => {
    pauseTimer();
    const ms = visibleMsRef.current;
    visibleMsRef.current = 0;
    return ms;
  };

  // ── Visibility change listener ────────────────────────────────────────────
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        pauseTimer();
        // Emit exit + flush when tab hides — path still valid
        if (prevPathRef.current) {
          const durationMs = collectVisibleMs();
          trackPageExit(prevPathRef.current, moduleFromPath(prevPathRef.current), durationMs);
          flush(true);
          // Resume tracking for when they come back (path unchanged)
          resumeTimer();
        }
      } else {
        resumeTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── beforeunload listener ─────────────────────────────────────────────────
  useEffect(() => {
    const handleUnload = () => {
      if (prevPathRef.current) {
        const durationMs = collectVisibleMs();
        trackPageExit(prevPathRef.current, moduleFromPath(prevPathRef.current), durationMs);
        flush(true); // use sendBeacon
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Route-change / first-mount handler ────────────────────────────────────
  useEffect(() => {
    if (!initializedRef.current) {
      // First mount — just track pageview and start timer
      initializedRef.current = true;
      prevPathRef.current = pathname;
      visibleMsRef.current = 0;
      if (!document.hidden) resumeTimer();
      trackPageview(pathname, moduleFromPath(pathname));
      return;
    }

    // Route changed
    const prevPath = prevPathRef.current;
    if (prevPath && prevPath !== pathname) {
      // Emit exit for previous page
      const durationMs = collectVisibleMs();
      trackPageExit(prevPath, moduleFromPath(prevPath), durationMs);
    }

    // Track new pageview and reset timer
    prevPathRef.current = pathname;
    visibleMsRef.current = 0;
    if (!document.hidden) resumeTimer();
    trackPageview(pathname, moduleFromPath(pathname));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}

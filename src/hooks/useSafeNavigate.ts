'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const NAV_WATCHDOG_MS = 5000;

/**
 * Client-side navigation with a hard-navigation fallback.
 *
 * Next.js App Router soft navigation can hang forever if the underlying RSC
 * fetch stalls (flaky mobile network, backgrounded PWA, broken service
 * worker) — the user is stuck on loading.tsx with no recovery. This hook arms
 * a watchdog on each navigation: if the pathname hasn't changed within
 * NAV_WATCHDOG_MS, it falls back to a full-page load of the target URL.
 *
 * Returns:
 *  - navigate(href): router.push(href) + watchdog
 *  - watch(href):    watchdog only — for <Link>, call from onClick and let
 *                    the Link perform the soft navigation itself
 */
export function useSafeNavigate() {
  const router   = useRouter();
  const pathname = usePathname();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Pathname changed → the soft navigation landed. Disarm the watchdog.
  useEffect(() => {
    clear();
  }, [pathname, clear]);

  // Disarm on unmount so a stale timer can't force a reload later.
  useEffect(() => clear, [clear]);

  const watch = useCallback(
    (href: string) => {
      clear();
      // Already on the target path — pathname won't change, so a watchdog
      // would misfire. Nothing to guard.
      if (pathname === href) return;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        window.location.href = href;
      }, NAV_WATCHDOG_MS);
    },
    [pathname, clear],
  );

  const navigate = useCallback(
    (href: string) => {
      watch(href);
      router.push(href);
    },
    [router, watch],
  );

  return { navigate, watch };
}

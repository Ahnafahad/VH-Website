'use client';

import { useEffect, useState } from 'react';
import type { NavBadges } from './admin-nav';

// Module-level so the sidebar and the phone nav (both mounted, one hidden by CSS) share one fetch.
let cached: { at: number; p: Promise<NavBadges | null> } | null = null;
const TTL = 60_000;

function load(): Promise<NavBadges | null> {
  if (!cached || Date.now() - cached.at > TTL) {
    cached = {
      at: Date.now(),
      p: fetch('/api/admin/nav-badges')
        .then(r => (r.ok ? (r.json() as Promise<NavBadges>) : null))
        .catch(() => null),
    };
  }
  return cached.p;
}

/** Live nav counts, fetched after paint. null until loaded (or if the call fails: nav still works). */
export function useNavBadges(): NavBadges | null {
  const [badges, setBadges] = useState<NavBadges | null>(null);
  useEffect(() => {
    let alive = true;
    void load().then(b => { if (alive) setBadges(b); });
    return () => { alive = false; };
  }, []);
  return badges;
}

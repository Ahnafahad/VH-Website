'use client';

import { useEffect, useState } from 'react';

interface Banner { text: string; level: 'info' | 'warn' | 'urgent'; expiresAt: number }

const COLORS = {
  info:   { bg: '#1A0507', fg: '#FAF5EF' },
  warn:   { bg: '#8A5A1A', fg: '#FAF5EF' },
  urgent: { bg: '#760F13', fg: '#FAF5EF' },
} as const;

/** Slim dismissible announcement bar set by the super admin (Broadcast > Compose). Fixed to the bottom so it never fights the floating header. */
export default function CommsBanner() {
  const [banner, setBanner] = useState<Banner | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/comms/banner')
      .then(r => r.json())
      .then((d: { banner: Banner | null }) => {
        if (!alive || !d.banner) return;
        try { if (localStorage.getItem('vh-banner-dismissed') === `${d.banner.expiresAt}`) return; } catch { /* storage blocked */ }
        setBanner(d.banner);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!banner) return null;
  const c = COLORS[banner.level] ?? COLORS.info;
  const dismiss = () => {
    try { localStorage.setItem('vh-banner-dismissed', `${banner.expiresAt}`); } catch { /* storage blocked */ }
    setBanner(null);
  };
  return (
    <div role="status" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60, background: c.bg, color: c.fg, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', fontSize: 13, lineHeight: 1.4 }}>
      <span style={{ flex: 1 }}>{banner.text}</span>
      <button type="button" onClick={dismiss} aria-label="Dismiss announcement" style={{ background: 'none', border: 'none', color: c.fg, fontSize: 18, lineHeight: 1, cursor: 'pointer', padding: 4 }}>&times;</button>
    </div>
  );
}

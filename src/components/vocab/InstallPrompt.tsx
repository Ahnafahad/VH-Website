'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

// v2: replaces the old 'lx-install-prompt-dismissed' permanent flag. Existing
// users carrying that old key are unaffected by it now (it's just dead) and
// get a fresh first-seen date under the new time-boxed rules below.
const STORAGE_KEY = 'lx-install-prompt-v2';
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

interface StoredState { firstSeenAt: number; dismissedUntil?: number }

function readState(): StoredState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as StoredState : null;
  } catch { return null; }
}
function writeState(s: StoredState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

type PromptState = 'android' | 'ios' | null;

export default function InstallPrompt() {
  const [state, setState] = useState<PromptState>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) return;

    // Phones only — desktop Chrome/Edge also fire beforeinstallprompt, but
    // the native browser install affordance already covers desktop.
    const ua = navigator.userAgent;
    const isMobile = /android|iphone|ipad|ipod/i.test(ua);
    if (!isMobile) return;

    const now = Date.now();
    let stored = readState();
    if (!stored) {
      stored = { firstSeenAt: now };
      writeState(stored);
    }
    // The whole feature sunsets 2 weeks after a user first saw it, dismissed or not.
    if (now - stored.firstSeenAt > TWO_WEEKS_MS) return;
    // An explicit dismissal suppresses it for 2 weeks from that dismissal.
    if (stored.dismissedUntil && now < stored.dismissedUntil) return;

    // Android: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setState('android');
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS detection: no beforeinstallprompt fires
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
    if (isIOS && isSafari) {
      setState('ios');
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    const stored = readState() ?? { firstSeenAt: Date.now() };
    writeState({ ...stored, dismissedUntil: Date.now() + TWO_WEEKS_MS });
    setState(null);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (deferredPrompt as any).prompt();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { outcome } = await (deferredPrompt as any).userChoice;
    if (outcome === 'accepted') {
      const stored = readState() ?? { firstSeenAt: Date.now() };
      writeState({ ...stored, dismissedUntil: Date.now() + TWO_WEEKS_MS });
    }
    setDeferredPrompt(null);
    setState(null);
  };

  return (
    <AnimatePresence>
      {state && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          style={{
            position:       'fixed',
            bottom:         'calc(72px + env(safe-area-inset-bottom) + 8px)',
            left:           8,
            right:          8,
            zIndex:         45,
            background:     'var(--color-lx-surface)',
            border:         '1px solid var(--color-lx-border)',
            borderRadius:   14,
            padding:        '12px 14px',
            display:        'flex',
            alignItems:     'center',
            gap:            12,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow:      '0 4px 24px rgba(0,0,0,0.35)',
            maxWidth:       420,
            margin:         '0 auto',
          }}
        >
          {/* Icon */}
          <div style={{
            width:          36,
            height:         36,
            borderRadius:   10,
            background:     'rgba(230,57,70,0.12)',
            border:         '1px solid rgba(230,57,70,0.25)',
            flexShrink:     0,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-lx-accent-red)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontFamily:  "'Sora', sans-serif",
              fontSize:    '0.75rem',
              fontWeight:  600,
              color:       'var(--color-lx-text-primary)',
              margin:      0,
              lineHeight:  1.3,
            }}>
              Add LexiCore to home screen
            </p>
            <p style={{
              fontFamily:    "'Sora', sans-serif",
              fontSize:      '0.62rem',
              color:         'var(--color-lx-text-muted)',
              margin:        '2px 0 0',
              lineHeight:    1.4,
            }}>
              {state === 'ios'
                ? 'Tap Share → Add to Home Screen'
                : 'Full-screen app, no browser chrome'}
            </p>
          </div>

          {/* CTA or dismiss */}
          {state === 'android' ? (
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={handleInstall}
              style={{
                padding:    '6px 12px',
                background: 'var(--color-lx-accent-red)',
                border:     'none',
                borderRadius: 8,
                cursor:     'pointer',
                fontFamily: "'Sora', sans-serif",
                fontSize:   '0.68rem',
                fontWeight: 700,
                color:      '#fff',
                flexShrink: 0,
              }}
            >
              Add
            </motion.button>
          ) : null}

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={dismiss}
            aria-label="Dismiss"
            style={{
              width:          28,
              height:         28,
              borderRadius:   '50%',
              background:     'var(--color-lx-elevated)',
              border:         '1px solid var(--color-lx-border)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              cursor:         'pointer',
              color:          'var(--color-lx-text-muted)',
              flexShrink:     0,
            }}
          >
            <X size={12} />
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

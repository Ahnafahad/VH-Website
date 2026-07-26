'use client';

import { useEffect, useState } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

// ─── Contracts (already built server-side) ─────────────────────────────────────
const PREFS_URL = '/api/notifications/preferences';
const SUBSCRIBE_URL = '/api/notifications/subscribe';
const UNSUBSCRIBE_URL = '/api/notifications/unsubscribe';

interface Prefs {
  notifyMaterials: boolean;
  notifyAnnouncements: boolean;
  notifyCommentReply: boolean;
}

interface LoadedPrefs extends Prefs {
  subscribed: boolean;
}

type PrefKey = keyof Prefs;

const CATEGORIES: { key: PrefKey; label: string; hint: string }[] = [
  { key: 'notifyMaterials', label: 'New materials', hint: 'When new class materials are posted' },
  { key: 'notifyAnnouncements', label: 'Announcements', hint: 'Important announcements from VH' },
  { key: 'notifyCommentReply', label: 'Comment replies', hint: 'When someone replies to your comment' },
];

// ─── Palette (matches the LMS dark theme) ──────────────────────────────────────
const CREAM = '#FAF5EF';
const TAN = '#D4B094';
const MAROON = '#760F13';

// ─── Outer: load prefs, then render the interactive panel ──────────────────────
export default function NotificationSettings() {
  const [loaded, setLoaded] = useState<LoadedPrefs | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(PREFS_URL);
        if (!res.ok) throw new Error('failed');
        const data = (await res.json()) as LoadedPrefs;
        if (!cancelled) setLoaded(data);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p className="text-sm" style={{ color: 'rgba(250,245,239,0.64)' }}>
        Couldn&apos;t load your notification settings. Please refresh and try again.
      </p>
    );
  }

  if (!loaded) {
    return (
      <p className="text-sm" style={{ color: 'rgba(250,245,239,0.5)' }}>
        Loading…
      </p>
    );
  }

  return <NotificationPanel initial={loaded} />;
}

// ─── Inner: the hook needs the resolved `subscribed` as its initial value ───────
function NotificationPanel({ initial }: { initial: LoadedPrefs }) {
  const { isSupported, isSubscribed, permission, isLoading, subscribe, unsubscribe } =
    usePushNotifications(initial.subscribed, {
      subscribeUrl: SUBSCRIBE_URL,
      unsubscribeUrl: UNSUBSCRIBE_URL,
    });

  const [prefs, setPrefs] = useState<Prefs>({
    notifyMaterials: initial.notifyMaterials,
    notifyAnnouncements: initial.notifyAnnouncements,
    notifyCommentReply: initial.notifyCommentReply,
  });

  const [showIosHint, setShowIosHint] = useState(false);

  // iOS + not-standalone hint (client-only).
  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setShowIosHint(isIos && !isStandalone);
  }, []);

  // Toggle a single category: optimistic update, PATCH just that field, revert on failure.
  async function toggleCategory(key: PrefKey, next: boolean) {
    setPrefs((p) => ({ ...p, [key]: next }));
    try {
      const res = await fetch(PREFS_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: next }),
      });
      if (!res.ok) throw new Error('patch failed');
      const updated = (await res.json()) as Prefs;
      setPrefs(updated);
    } catch {
      setPrefs((p) => ({ ...p, [key]: !next }));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* iOS home-screen hint */}
      {showIosHint && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{
            backgroundColor: 'rgba(212,176,148,0.10)',
            border: '1px solid rgba(212,176,148,0.24)',
            color: 'rgba(250,245,239,0.82)',
          }}
        >
          On iPhone, add this site to your Home Screen first (Share → Add to Home Screen) to
          receive notifications. Notifications don&apos;t work in the normal Safari tab.
        </div>
      )}

      {/* Primary enable/disable card */}
      <div
        className="rounded-2xl p-5"
        style={{
          backgroundColor: 'rgba(250,245,239,0.04)',
          border: '1px solid rgba(250,245,239,0.10)',
        }}
      >
        <h2 className="font-heading font-medium text-lg mb-1" style={{ color: CREAM }}>
          Push notifications
        </h2>

        {!isSupported ? (
          <p className="text-sm" style={{ color: 'rgba(250,245,239,0.64)' }}>
            This browser doesn&apos;t support notifications.
          </p>
        ) : (
          <>
            <p className="text-sm mb-4" style={{ color: 'rgba(250,245,239,0.64)' }}>
              {isSubscribed
                ? "You're receiving notifications on this device."
                : 'Get notified about your classes, materials, and more.'}
            </p>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => (isSubscribed ? unsubscribe() : subscribe())}
              className="w-full rounded-xl px-4 py-3 text-sm font-medium transition-colors"
              style={{
                backgroundColor: isSubscribed ? 'rgba(250,245,239,0.08)' : MAROON,
                color: CREAM,
                border: isSubscribed ? '1px solid rgba(250,245,239,0.16)' : '1px solid transparent',
                cursor: isLoading ? 'default' : 'pointer',
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              {isLoading ? '…' : isSubscribed ? 'Disable notifications' : 'Enable notifications'}
            </button>

            {permission === 'denied' && (
              <p className="text-xs mt-3" style={{ color: 'rgba(250,245,239,0.5)' }}>
                Notifications are blocked. Re-enable them in your browser settings to receive
                them.
              </p>
            )}
          </>
        )}
      </div>

      {/* Category toggles */}
      <div
        className="rounded-2xl p-5"
        style={{
          backgroundColor: 'rgba(250,245,239,0.04)',
          border: '1px solid rgba(250,245,239,0.10)',
          opacity: isSubscribed ? 1 : 0.55,
        }}
      >
        <h2 className="font-heading font-medium text-lg mb-1" style={{ color: CREAM }}>
          Categories
        </h2>
        {!isSubscribed && (
          <p className="text-xs mb-4" style={{ color: 'rgba(250,245,239,0.5)' }}>
            Enable notifications to choose categories.
          </p>
        )}

        <div className="flex flex-col gap-1">
          {CATEGORIES.map((cat) => (
            <label
              key={cat.key}
              className="flex items-start justify-between gap-4 py-3"
              style={{ cursor: 'pointer' }}
            >
              <span className="flex flex-col">
                <span className="text-sm font-medium" style={{ color: CREAM }}>
                  {cat.label}
                </span>
                <span className="text-xs" style={{ color: 'rgba(250,245,239,0.5)' }}>
                  {cat.hint}
                </span>
              </span>
              <input
                type="checkbox"
                checked={prefs[cat.key]}
                onChange={(e) => toggleCategory(cat.key, e.target.checked)}
                className="mt-0.5 h-5 w-5 flex-shrink-0"
                style={{ accentColor: TAN }}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

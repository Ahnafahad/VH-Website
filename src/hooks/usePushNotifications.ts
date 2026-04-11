'use client';

/**
 * usePushNotifications — client-side hook for managing Web Push subscriptions.
 *
 * Usage:
 *   const { isSupported, isSubscribed, permission, subscribe, unsubscribe } =
 *     usePushNotifications(initialSubscribed);
 *
 * The Settings page passes `data.notificationsEnabled` as the initial value so
 * the toggle reflects the persisted state on first render.
 *
 * subscribe()   — requests Notification permission (if needed), creates a
 *                 PushSubscription via the service worker, then POSTs it to
 *                 /api/vocab/push/subscribe (which also sets notificationsEnabled=true).
 *
 * unsubscribe() — removes the browser-level PushSubscription, then POSTs to
 *                 /api/vocab/push/unsubscribe (which sets notificationsEnabled=false).
 */

import { useCallback, useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PushPermission = NotificationPermission | 'unsupported';

export interface UsePushNotificationsReturn {
  /** True when the browser supports service workers + push + notifications. */
  isSupported:  boolean;
  /** True when the user has an active push subscription stored server-side. */
  isSubscribed: boolean;
  /** Current Notification permission state, or 'unsupported'. */
  permission:   PushPermission;
  /** Loading — true while subscribe/unsubscribe is in flight. */
  isLoading:    boolean;
  /** Subscribe: request permission, register subscription, persist to server. */
  subscribe:    () => Promise<void>;
  /** Unsubscribe: remove browser subscription and clear from server. */
  unsubscribe:  () => Promise<void>;
}

// ─── VAPID public key helper ──────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding  = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64   = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData  = window.atob(base64);
  const output   = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePushNotifications(
  initialSubscribed = false,
): UsePushNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(initialSubscribed);
  const [permission, setPermission]   = useState<PushPermission>('default');
  const [isLoading, setIsLoading]     = useState(false);

  // Detect support + current permission on mount (client only).
  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
    } else {
      setPermission('unsupported');
    }
  }, []);

  // ── subscribe ──────────────────────────────────────────────────────────────

  const subscribe = useCallback(async () => {
    if (!isSupported) return;
    setIsLoading(true);

    try {
      // 1. Request permission if not yet granted.
      if (Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission();
        setPermission(perm);
        if (perm !== 'granted') return;
      }

      // 2. Wait for an active service worker registration.
      const registration = await navigator.serviceWorker.ready;

      // 3. Subscribe via PushManager.
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.error('[usePushNotifications] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set');
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
      });

      // 4. Persist to server — this also sets notificationsEnabled = true.
      const res = await fetch('/api/vocab/push/subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ subscription: subscription.toJSON() }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        console.error('[usePushNotifications] subscribe API error:', err?.error);
        return;
      }

      setIsSubscribed(true);
    } catch (err) {
      console.error('[usePushNotifications] subscribe error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  // ── unsubscribe ────────────────────────────────────────────────────────────

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return;
    setIsLoading(true);

    try {
      // 1. Remove subscription from the browser's PushManager.
      const registration  = await navigator.serviceWorker.ready;
      const subscription  = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }

      // 2. Clear from server — this also sets notificationsEnabled = false.
      const res = await fetch('/api/vocab/push/unsubscribe', {
        method: 'POST',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        console.error('[usePushNotifications] unsubscribe API error:', err?.error);
        return;
      }

      setIsSubscribed(false);
    } catch (err) {
      console.error('[usePushNotifications] unsubscribe error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  return { isSupported, isSubscribed, permission, isLoading, subscribe, unsubscribe };
}

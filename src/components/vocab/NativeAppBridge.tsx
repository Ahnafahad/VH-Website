'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import { registerTapListener, rescheduleFromCache } from '@/lib/vocab/local-reminders';

function safeAppPath(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'org.beyondthehorizons.vhapp:' && url.hostname !== 'www.vh-beyondthehorizons.org') return null;
    const path = `${url.pathname}${url.search}${url.hash}`;
    return path.startsWith('/vocab') ? path : '/vocab/home';
  } catch {
    return null;
  }
}

function closeTopOverlay(): boolean {
  const dialog = document.querySelector<HTMLDialogElement>('dialog[open]');
  if (dialog) { dialog.close(); return true; }
  const overlay = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]');
  if (!overlay) return false;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return true;
}

export function NativeAppBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const removers: Array<() => Promise<void>> = [];

    void App.addListener('appUrlOpen', ({ url }) => {
      const path = safeAppPath(url);
      if (path) router.push(path);
    }).then(handle => removers.push(() => handle.remove()));

    void App.addListener('backButton', ({ canGoBack }) => {
      if (closeTopOverlay()) return;
      if (canGoBack && window.location.pathname !== '/vocab/home') window.history.back();
      else void App.exitApp();
    }).then(handle => removers.push(() => handle.remove()));

    void App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) window.dispatchEvent(new CustomEvent('lexicore:resume'));
    }).then(handle => removers.push(() => handle.remove()));

    void PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
      const target = notification.data?.url ?? notification.data?.path;
      if (typeof target === 'string') {
        const path = target.startsWith('/vocab') ? target : safeAppPath(target);
        if (path) router.push(path);
      }
    }).then(handle => removers.push(() => handle.remove()));

    // Local notification tap routing — mirrors push routing above.
    void registerTapListener((path) => { router.push(path); })
      .then(cleanup => removers.push(async () => { cleanup(); }));

    // Reschedule on every app resume so data stays fresh.
    const onResume = () => { void rescheduleFromCache(); };
    window.addEventListener('lexicore:resume', onResume);

    return () => {
      window.removeEventListener('lexicore:resume', onResume);
      for (const remove of removers) void remove();
    };
  }, [router]);

  return null;
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CloudOff, RefreshCw, Wifi } from 'lucide-react';

export type ConnectionState = 'online' | 'degraded' | 'offline' | 'recovering';

export function ConnectionStatus() {
  const [state, setState] = useState<ConnectionState>('online');
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((next: ConnectionState) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setState(next);
    setVisible(true);
    if (next === 'online') hideTimer.current = setTimeout(() => setVisible(false), 2600);
  }, []);

  const retry = useCallback(async () => {
    show('recovering');
    try {
      const response = await fetch('/api/vocab/daily-message', {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      show(response.ok ? 'online' : 'degraded');
    } catch {
      show('offline');
    }
  }, [show]);

  useEffect(() => {
    const onOffline = () => show('offline');
    const onOnline = () => void retry();
    if (!navigator.onLine) onOffline();
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [retry, show]);

  if (!visible) return null;

  const online = state === 'online';
  const recovering = state === 'recovering';
  const Icon = online ? Wifi : recovering ? RefreshCw : CloudOff;
  const title = online ? 'You’re back online' : recovering ? 'Checking your connection…' : state === 'degraded' ? 'LexiCore is taking longer than usual' : 'Your connection dropped';
  const description = online ? 'Your learning session can continue.' : recovering ? 'Your progress is safe while we reconnect.' : 'Stay on this screen. We’ll keep your place while you reconnect.';

  return (
    <section className="lx-connection-status" data-state={state} role={online ? 'status' : 'alert'} aria-live={online ? 'polite' : 'assertive'}>
      <Icon className={recovering ? 'lx-spin' : undefined} size={20} aria-hidden />
      <div className="lx-connection-copy"><strong>{title}</strong><span>{description}</span></div>
      {!online && !recovering && <button type="button" onClick={() => void retry()}>Try again</button>}
    </section>
  );
}

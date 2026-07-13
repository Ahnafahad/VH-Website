'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { trackFeature } from '@/lib/analytics/tracker';

function safeMessage(value: unknown): string {
  const message = value instanceof Error ? value.message : String(value);
  return message.replace(/https?:\/\/\S+/g, '[url]').slice(0, 180);
}

export function LexiTelemetry() {
  useEffect(() => {
    const platform = Capacitor.getPlatform();
    const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType;
    const report = (name: string, value: number) => trackFeature('performance_metric', 'vocab', {
      name, value: Math.round(value), platform, connection,
    });

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (navigation) {
      report('ttfb', navigation.responseStart - navigation.requestStart);
      report('dom_interactive', navigation.domInteractive - navigation.startTime);
    }

    const observers: PerformanceObserver[] = [];
    try {
      const paintObserver = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) if (entry.name === 'first-contentful-paint') report('fcp', entry.startTime);
      });
      paintObserver.observe({ type: 'paint', buffered: true });
      observers.push(paintObserver);

      const lcpObserver = new PerformanceObserver(list => {
        const last = list.getEntries().at(-1);
        if (last) report('lcp', last.startTime);
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      observers.push(lcpObserver);

      const longTaskObserver = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) if (entry.duration >= 100) report('long_task', entry.duration);
      });
      longTaskObserver.observe({ type: 'longtask', buffered: true });
      observers.push(longTaskObserver);
    } catch { /* Older WebViews may not support every observer type. */ }

    const onError = (event: ErrorEvent) => trackFeature('client_error', 'vocab', {
      message: safeMessage(event.error ?? event.message), platform,
    });
    const onRejection = (event: PromiseRejectionEvent) => trackFeature('unhandled_rejection', 'vocab', {
      message: safeMessage(event.reason), platform,
    });
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      for (const observer of observers) observer.disconnect();
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}

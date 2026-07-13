'use client';

import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Download, X } from 'lucide-react';
import { compareVersions } from '@/lib/vocab/app-version';

interface UpdateState { required: boolean; storeUrl: string; latestVersion: string }

export function AppUpdatePrompt() {
  const [update, setUpdate] = useState<UpdateState | null>(null);
  const updateButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void Promise.all([
      App.getInfo(),
      fetch('/api/vocab/app-version', { cache: 'no-store' }).then(response => response.json()) as Promise<{ latestVersion: string | null; minimumVersion: string | null; storeUrl: string }>,
    ]).then(([info, config]) => {
      if (!config.latestVersion || compareVersions(info.version, config.latestVersion) >= 0) return;
      const skipped = localStorage.getItem('lx-skipped-version');
      const required = Boolean(config.minimumVersion && compareVersions(info.version, config.minimumVersion) < 0);
      if (!required && skipped === config.latestVersion) return;
      setUpdate({ required, storeUrl: config.storeUrl, latestVersion: config.latestVersion });
    }).catch(() => { /* Updates must never block app startup on a failed check. */ });
  }, []);

  useEffect(() => {
    if (!update) return;
    const timer = window.setTimeout(() => updateButtonRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [update]);

  if (!update) return null;
  const dismiss = () => {
    if (update.required) return;
    localStorage.setItem('lx-skipped-version', update.latestVersion);
    setUpdate(null);
  };

  return (
    <div className="lx-update-backdrop" role="dialog" aria-modal="true" aria-labelledby="lx-update-title">
      <section className="lx-update-prompt">
        {!update.required && <button type="button" className="lx-update-close" onClick={dismiss} aria-label="Not now"><X size={18} /></button>}
        <span className="lx-update-icon" aria-hidden><Download size={24} /></span>
        <h2 id="lx-update-title" className="lx-word">A sharper LexiCore is ready.</h2>
        <p>{update.required ? 'This update is required to keep sessions and progress working safely.' : 'Update for the latest learning improvements and Android refinements.'}</p>
        <button ref={updateButtonRef} type="button" className="lx-action lx-action-primary" onClick={() => void Browser.open({ url: update.storeUrl })}>Update LexiCore</button>
        {!update.required && <button type="button" className="lx-update-later" onClick={dismiss}>Not now</button>}
      </section>
    </div>
  );
}

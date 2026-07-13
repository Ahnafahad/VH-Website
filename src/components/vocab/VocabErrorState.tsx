'use client';

import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface VocabErrorStateProps {
  title?: string;
  description?: string;
  onRetry: () => void;
  retryLabel?: string;
}

export function VocabErrorState({
  title = 'This page didn’t load',
  description = 'Your progress is safe. Check your connection and try again.',
  onRetry,
  retryLabel = 'Try again',
}: VocabErrorStateProps) {
  const router = useRouter();

  return (
    <main className="lx-error-state" aria-labelledby="lx-error-title">
      <div className="lx-error-mark" aria-hidden="true"><AlertTriangle size={24} /></div>
      <h1 id="lx-error-title" className="lx-word">{title}</h1>
      <p>{description}</p>
      <div className="lx-error-actions">
        <button className="lx-action lx-action-primary" type="button" onClick={onRetry}>
          <RefreshCw size={17} aria-hidden />
          {retryLabel}
        </button>
        <button className="lx-action lx-action-secondary" type="button" onClick={() => router.push('/vocab/home')}>
          <Home size={17} aria-hidden />
          Return home
        </button>
      </div>
    </main>
  );
}

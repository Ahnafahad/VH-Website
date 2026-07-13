'use client';

import { useEffect } from 'react';
import { VocabErrorState } from '@/components/vocab/VocabErrorState';

export default function VocabShellError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[LexiCore] route error', { message: error.message, digest: error.digest });
  }, [error]);

  return <VocabErrorState onRetry={reset} />;
}

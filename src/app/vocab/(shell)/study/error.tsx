'use client';

import { useEffect } from 'react';
import { VocabErrorState } from '@/components/vocab/VocabErrorState';

export default function StudyError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[LexiCore study] route error', { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <VocabErrorState
      title="Your study units didn’t load"
      description="Your progress is safe. Check your connection, then try loading your study plan again."
      onRetry={reset}
      retryLabel="Load study plan"
    />
  );
}

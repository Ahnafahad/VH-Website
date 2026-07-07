'use client';

import { useEffect } from 'react';

// Top-level error boundary — catches unhandled route errors (including failed
// client-side RSC navigations) app-wide so users always get a recovery path
// instead of a hung loading state.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app] route error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-2xl font-bold text-gray-900">Something went wrong</h2>
      <p className="max-w-md text-sm text-gray-600">
        An unexpected error occurred while loading this page. Check your
        connection and try again.
      </p>
      <div className="mt-2 flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-700"
        >
          Try again
        </button>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
        >
          Reload page
        </button>
      </div>
    </div>
  );
}

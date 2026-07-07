'use client';

import { useEffect } from 'react';

// Error boundary for /vocab/study — catches failed RSC fetches (e.g. the
// service worker's network timeout firing on a stalled connection) so users
// get a retry button instead of an infinite loading skeleton.
export default function StudyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[vocab/study] route error:', error);
  }, [error]);

  return (
    <div
      style={{
        padding:       '4rem 1.25rem 2rem',
        maxWidth:      672,
        margin:        '0 auto',
        textAlign:     'center',
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        gap:           12,
      }}
    >
      <h2
        className="lx-word"
        style={{
          fontSize:   '1.6rem',
          fontWeight: 700,
          color:      'var(--color-lx-text-primary, #fff)',
        }}
      >
        Something went wrong
      </h2>
      <p
        style={{
          fontSize: '0.85rem',
          color:    'var(--color-lx-text-secondary, rgba(255,255,255,0.6))',
          maxWidth: 320,
        }}
      >
        We couldn&rsquo;t load your study units. Check your connection and try
        again.
      </p>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button
          onClick={reset}
          style={{
            padding:      '10px 22px',
            borderRadius: 12,
            border:       '1px solid rgba(230,57,70,0.4)',
            background:   'rgba(230,57,70,0.12)',
            color:        'var(--color-lx-text-primary, #fff)',
            fontSize:     '0.85rem',
            fontWeight:   600,
            cursor:       'pointer',
          }}
        >
          Try again
        </button>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding:      '10px 22px',
            borderRadius: 12,
            border:       '1px solid rgba(255,255,255,0.12)',
            background:   'rgba(255,255,255,0.06)',
            color:        'var(--color-lx-text-secondary, rgba(255,255,255,0.6))',
            fontSize:     '0.85rem',
            fontWeight:   600,
            cursor:       'pointer',
          }}
        >
          Reload page
        </button>
      </div>
    </div>
  );
}

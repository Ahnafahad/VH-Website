import type { Metadata } from 'next';

// Update these constants with each release.
// versionName from android/app/build.gradle
const VERSION = '1.0';
// Byte size of public/app/lexicore.apk — run: stat public/app/lexicore.apk | grep Size
const APK_BYTES = 3_227_943;

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const SITE_URL = 'https://www.vh-beyondthehorizons.org';

export const metadata: Metadata = {
  title: 'Download LexiCore for Android',
  description:
    'Download LexiCore — the VH vocabulary app. Build lasting vocabulary with smart review and active recall. Free APK for Android.',
  alternates: {
    canonical: `${SITE_URL}/app`,
  },
  openGraph: {
    title: 'Download LexiCore for Android',
    description:
      'Build lasting vocabulary with smart review and active recall.',
    url: `${SITE_URL}/app`,
    siteName: 'Beyond the Horizons',
    type: 'website',
  },
};

export default function AppDownloadPage() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#0F0F0F',
        color: '#F5F5F5',
        fontFamily: "var(--font-lexi-ui, 'Sora', system-ui, sans-serif)",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        boxSizing: 'border-box',
      }}
    >
      <main
        style={{
          width: '100%',
          maxWidth: '400px',
          display: 'flex',
          flexDirection: 'column',
          gap: '32px',
        }}
      >
        {/* Wordmark */}
        <header style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h1
            className="lx-word"
            style={{
              margin: 0,
              fontSize: 'clamp(2.5rem, 8vw, 3.5rem)',
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-0.01em',
              color: '#F5F5F5',
            }}
          >
            LexiCore
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: '1rem',
              color: '#B0B0B0',
              lineHeight: 1.5,
            }}
          >
            Build lasting vocabulary with smart review and active recall.
          </p>
        </header>

        {/* Download CTA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <a
            href="/app/lexicore.apk"
            download="lexicore.apk"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              minHeight: '52px',
              padding: '0 24px',
              background: '#E63946',
              color: '#FFFFFF',
              fontFamily: "var(--font-lexi-ui, 'Sora', system-ui, sans-serif)",
              fontSize: '1rem',
              fontWeight: 600,
              textDecoration: 'none',
              borderRadius: '12px',
              letterSpacing: '0.01em',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M10 3v10m0 0-3.5-3.5M10 13l3.5-3.5M4 17h12"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Download for Android
          </a>
          <p
            style={{
              margin: 0,
              fontSize: '0.8125rem',
              color: '#858585',
              textAlign: 'center',
            }}
          >
            Version {VERSION} &middot; {formatBytes(APK_BYTES)} &middot; Android 8.0+
          </p>
        </div>

        {/* Install steps */}
        <section
          style={{
            background: '#1A1A1A',
            border: '1px solid #363636',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#B0B0B0',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            How to install
          </h2>
          <ol
            style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {[
              'Tap the download button above to save the APK file.',
              'Open the downloaded file from your notifications or Files app.',
              'When Android asks, allow installs from this source.',
              'Open LexiCore and sign in with your Google account.',
            ].map((step, i) => (
              <li
                key={i}
                style={{
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'flex-start',
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: '#242424',
                    border: '1px solid #363636',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#F4A828',
                    lineHeight: 1,
                  }}
                >
                  {i + 1}
                </span>
                <span
                  style={{
                    fontSize: '0.9375rem',
                    color: '#F5F5F5',
                    lineHeight: 1.55,
                    paddingTop: '2px',
                  }}
                >
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}

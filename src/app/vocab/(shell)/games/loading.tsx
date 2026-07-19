// Hardcoded skeleton color so it's visible even before CSS vars are applied
const SK = 'rgba(255,255,255,0.10)';
const SK_CARD = 'rgba(255,255,255,0.06)';
const SK_BORDER = 'rgba(255,255,255,0.08)';

export default function GamesHubLoading() {
  return (
    <div style={{ padding: '2.5rem 1.25rem 2rem', maxWidth: 672, margin: '0 auto' }}>

      {/* Header skeleton */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{
          width: 90, height: 10, borderRadius: 6, marginBottom: 12,
          background: SK,
          animation: 'lx-pulse 1.6s ease-in-out infinite',
        }} />
        <div style={{
          width: 180, height: 28, borderRadius: 8,
          background: SK,
          animation: 'lx-pulse 1.6s ease-in-out infinite',
        }} />
      </div>

      {/* Hero card skeleton */}
      <div style={{
        height: 200, borderRadius: 18,
        background: SK_CARD,
        border: `1px solid ${SK_BORDER}`,
        marginBottom: '2rem',
        animation: 'lx-pulse 1.6s ease-in-out infinite',
      }} />

      {/* Archive rows skeleton */}
      <div style={{
        width: 120, height: 10, borderRadius: 6, marginBottom: 12,
        background: SK,
        animation: 'lx-pulse 1.6s ease-in-out infinite',
      }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 52, borderRadius: 10,
              background: SK_CARD,
              border: `1px solid ${SK_BORDER}`,
              opacity: 1 - i * 0.1,
              animation: 'lx-pulse 1.6s ease-in-out infinite',
              animationDelay: `${i * 80}ms`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes lx-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }
      `}</style>
    </div>
  );
}

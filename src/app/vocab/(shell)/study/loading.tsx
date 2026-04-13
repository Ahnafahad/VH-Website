// Hardcoded skeleton color so it's visible even before CSS vars are applied
const SK = 'rgba(255,255,255,0.10)';
const SK_CARD = 'rgba(255,255,255,0.06)';
const SK_BORDER = 'rgba(255,255,255,0.08)';

export default function StudyLoading() {
  return (
    <div style={{ padding: '2.5rem 1.25rem 2rem', maxWidth: 672, margin: '0 auto' }}>

      {/* Header skeleton */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{
          width: 70, height: 10, borderRadius: 6, marginBottom: 12,
          background: SK,
          animation: 'lx-pulse 1.6s ease-in-out infinite',
        }} />
        <div style={{
          width: 180, height: 28, borderRadius: 8, marginBottom: 10,
          background: SK,
          animation: 'lx-pulse 1.6s ease-in-out infinite',
        }} />
        <div style={{
          width: 230, height: 12, borderRadius: 6,
          background: SK,
          animation: 'lx-pulse 1.6s ease-in-out infinite',
        }} />
      </div>

      {/* Unit card skeletons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{
              borderRadius: 20,
              background: SK_CARD,
              border: `1px solid ${SK_BORDER}`,
              padding: '1.25rem',
              opacity: 1 - i * 0.15,
              animation: 'lx-pulse 1.6s ease-in-out infinite',
              animationDelay: `${i * 100}ms`,
            }}
          >
            {/* Unit header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ width: 120, height: 14, borderRadius: 5, background: SK }} />
              <div style={{ width: 50, height: 14, borderRadius: 5, background: SK }} />
            </div>
            {/* Progress bar */}
            <div style={{ height: 4, borderRadius: 4, background: SK, marginBottom: 14 }} />
            {/* Theme rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: SK, flexShrink: 0 }} />
                  <div style={{ flex: 1, height: 11, borderRadius: 4, background: SK, width: `${55 + j * 12}%` }} />
                </div>
              ))}
            </div>
          </div>
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

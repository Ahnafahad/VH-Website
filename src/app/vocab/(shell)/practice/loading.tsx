// Hardcoded skeleton color so it's visible even before CSS vars are applied
const SK = 'rgba(255,255,255,0.10)';
const SK_CARD = 'rgba(255,255,255,0.06)';
const SK_BORDER = 'rgba(255,255,255,0.08)';

export default function PracticeLoading() {
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
          width: 200, height: 28, borderRadius: 8, marginBottom: 10,
          background: SK,
          animation: 'lx-pulse 1.6s ease-in-out infinite',
        }} />
        <div style={{
          width: 260, height: 12, borderRadius: 6,
          background: SK,
          animation: 'lx-pulse 1.6s ease-in-out infinite',
        }} />
      </div>

      {/* Tab switcher skeleton */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: '1.25rem',
        borderBottom: `1px solid ${SK_BORDER}`, paddingBottom: 12,
      }}>
        <div style={{ width: 80, height: 14, borderRadius: 6, background: SK, animation: 'lx-pulse 1.6s ease-in-out infinite' }} />
        <div style={{ width: 80, height: 14, borderRadius: 6, background: SK, animation: 'lx-pulse 1.6s ease-in-out infinite', opacity: 0.5 }} />
      </div>

      {/* Theme card skeletons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 72, borderRadius: 16,
              background: SK_CARD,
              border: `1px solid ${SK_BORDER}`,
              padding: '1rem',
              display: 'flex', alignItems: 'center', gap: 16,
              opacity: 1 - i * 0.1,
              animation: 'lx-pulse 1.6s ease-in-out infinite',
              animationDelay: `${i * 80}ms`,
            }}
          >
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ width: `${60 + (i % 3) * 15}%`, height: 13, borderRadius: 5, background: SK }} />
              <div style={{ width: '40%', height: 8, borderRadius: 4, background: SK }} />
            </div>
            <div style={{ width: 22, height: 22, borderRadius: 5, background: SK, flexShrink: 0 }} />
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

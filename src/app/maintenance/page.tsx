export const metadata = { title: 'Back soon', robots: { index: false } };

export default function MaintenancePage() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-heading), Georgia, serif', fontSize: 28, margin: '0 0 8px' }}>We will be back soon</h1>
        <p style={{ margin: 0, opacity: 0.7 }}>The site is down for a short maintenance break. Please check back in a little while.</p>
      </div>
    </main>
  );
}

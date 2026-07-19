'use client';

const SANS  = "'Sora', sans-serif";
const SERIF = "'Cormorant Garamond', Georgia, serif";

const TONE_LABEL: Record<'positive' | 'negative' | 'neutral', string> = {
  positive: 'Positive',
  negative: 'Negative',
  neutral:  'Neutral',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{
        fontFamily: SANS, fontSize: '0.56rem', fontWeight: 600,
        letterSpacing: '0.14em', textTransform: 'uppercase',
        color: 'var(--color-lx-text-muted)',
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: SERIF, fontStyle: 'italic', fontWeight: 600,
        fontSize: '1.05rem', color: 'var(--color-lx-text-primary)', lineHeight: 1.2,
      }}>
        {children}
      </span>
    </div>
  );
}

export default function ClueDossier({
  topic,
  wordType,
  letterCount,
  tone,
  isCatchUp,
}: {
  topic:       string;
  wordType:    string;
  letterCount: number;
  tone:        'positive' | 'negative' | 'neutral';
  isCatchUp:   boolean;
}) {
  return (
    <div style={{
      background: 'var(--color-lx-surface)',
      border: '1px solid var(--color-lx-border)',
      borderRadius: 16,
      padding: '1.125rem 1.25rem',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
        <span style={{
          fontFamily: SANS, fontSize: '0.58rem', fontWeight: 700,
          letterSpacing: '0.16em', textTransform: 'uppercase',
          color: 'var(--color-lx-accent-red)',
        }}>
          Today&apos;s Word
        </span>
        {isCatchUp && (
          <span style={{
            fontFamily: SANS, fontSize: '0.6rem', fontWeight: 700,
            color: 'var(--color-lx-accent-gold)',
            background: 'rgba(244,168,40,0.12)',
            border: '1px solid rgba(244,168,40,0.3)',
            borderRadius: 20, padding: '0.2rem 0.6rem',
          }}>
            Catch-up round · ¼ points
          </span>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '0.875rem 1rem',
      }}>
        <Field label="Topic">{topic}</Field>
        <Field label="Word type">{wordType}</Field>
        <Field label="Letters">{letterCount}</Field>
        <Field label="Tone">{TONE_LABEL[tone]}</Field>
      </div>
    </div>
  );
}

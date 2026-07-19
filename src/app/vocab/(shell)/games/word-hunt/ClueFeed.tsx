'use client';

import type { UnlockedClues } from '@/lib/vocab/game/types';

const SANS  = "'Sora', sans-serif";
const SERIF = "'Cormorant Garamond', Georgia, serif";

function ClueLabel({ n, title }: { n: number; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.5rem' }}>
      <span style={{
        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
        background: 'var(--color-lx-elevated)', border: '1px solid var(--color-lx-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: SANS, fontSize: '0.58rem', fontWeight: 700, color: 'var(--color-lx-text-muted)',
      }}>
        {n}
      </span>
      <span style={{
        fontFamily: SANS, fontSize: '0.58rem', fontWeight: 600,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        color: 'var(--color-lx-text-muted)',
      }}>
        {title}
      </span>
    </div>
  );
}

function ClueCard({ n, title, delay, children }: { n: number; title: string; delay: number; children: React.ReactNode }) {
  return (
    <div
      className="lx-clue-card"
      style={{
        background: 'var(--color-lx-surface)',
        border: '1px solid var(--color-lx-border)',
        borderRadius: 14,
        padding: '1rem 1.125rem',
        animationDelay: `${delay}ms`,
      }}
    >
      <ClueLabel n={n} title={title} />
      {children}
    </div>
  );
}

export default function ClueFeed({
  clues,
  onPickChoice,
  readOnly = false,
}: {
  clues: UnlockedClues;
  onPickChoice: (word: string) => void;
  readOnly?: boolean;
}) {
  const items: React.ReactNode[] = [];

  if (clues.clue1Distinction) {
    items.push(
      <ClueCard key="c1" n={1} title="What sets it apart" delay={0}>
        <p style={{ fontFamily: SERIF, fontSize: '1rem', fontStyle: 'italic', lineHeight: 1.55, color: 'var(--color-lx-text-secondary)', margin: 0 }}>
          {clues.clue1Distinction}
        </p>
      </ClueCard>,
    );
  }

  if (clues.clue2Characteristics?.length) {
    items.push(
      <ClueCard key="c2" n={2} title="Characteristics" delay={0}>
        <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {clues.clue2Characteristics.map((c, i) => (
            <li key={i} style={{ fontFamily: SANS, fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--color-lx-text-secondary)' }}>
              {c}
            </li>
          ))}
        </ul>
      </ClueCard>,
    );
  }

  if (clues.clue3Note || clues.clue4ContextSentence) {
    items.push(
      <ClueCard key="c3" n={3} title="In context" delay={0}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {clues.clue4ContextSentence && (
            <blockquote style={{
              margin: 0, padding: '0.625rem 0.875rem',
              borderLeft: '2px solid var(--color-lx-accent-gold)',
              fontFamily: SERIF, fontSize: '1rem', fontStyle: 'italic',
              lineHeight: 1.55, color: 'var(--color-lx-text-primary)',
            }}>
              &ldquo;{clues.clue4ContextSentence}&rdquo;
            </blockquote>
          )}
          {clues.clue3Note && (
            <p style={{ fontFamily: SANS, fontSize: '0.78rem', color: 'var(--color-lx-text-muted)', margin: 0, lineHeight: 1.5 }}>
              {clues.clue3Note}
            </p>
          )}
        </div>
      </ClueCard>,
    );
  }

  if (clues.clue5FirstLetter) {
    items.push(
      <ClueCard key="c5" n={4} title="First letter" delay={0}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{
            width: 46, height: 46, borderRadius: 10, flexShrink: 0,
            background: 'rgba(230,57,70,0.1)', border: '1px solid rgba(230,57,70,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: SERIF, fontStyle: 'italic', fontWeight: 700,
            fontSize: '1.6rem', color: 'var(--color-lx-accent-red)', textTransform: 'uppercase',
          }}>
            {clues.clue5FirstLetter}
          </span>
          {clues.clue5Extra && (
            <p style={{ fontFamily: SANS, fontSize: '0.82rem', color: 'var(--color-lx-text-secondary)', margin: 0, lineHeight: 1.5 }}>
              {clues.clue5Extra}
            </p>
          )}
        </div>
      </ClueCard>,
    );
  }

  if (clues.clue6Choices?.length) {
    items.push(
      <ClueCard key="c6" n={5} title="Pick a candidate" delay={0}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {clues.clue6Choices.map(choice => (
            <button
              key={choice}
              type="button"
              disabled={readOnly}
              onClick={() => onPickChoice(choice)}
              style={{
                minHeight: 44, padding: '0.5rem 1rem',
                background: 'var(--color-lx-elevated)',
                border: '1px solid var(--color-lx-border)',
                borderRadius: 20, cursor: readOnly ? 'default' : 'pointer',
                opacity: readOnly ? 0.6 : 1,
                fontFamily: SERIF, fontStyle: 'italic', fontWeight: 600,
                fontSize: '0.95rem', color: 'var(--color-lx-text-primary)',
                textTransform: 'capitalize',
              }}
            >
              {choice}
            </button>
          ))}
        </div>
      </ClueCard>,
    );
  }

  if (items.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items}
      <style>{`
        @keyframes lx-clue-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: none; }
        }
        .lx-clue-card {
          animation: lx-clue-in 0.42s cubic-bezier(.22,1,.36,1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .lx-clue-card { animation: none; }
        }
      `}</style>
    </div>
  );
}

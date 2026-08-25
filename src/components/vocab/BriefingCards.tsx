'use client';

/**
 * Today's Briefing — the curated case-card list shown at the top of Study
 * and Practice, above the manual theme/letter picker. Same taxonomy (and
 * the same art per kind) as Home's single hero recommendation, so the
 * whole app agrees on what "Repeat Offenders" etc. mean and look like.
 */

import { motion } from 'framer-motion';
import { Clock3 } from 'lucide-react';
import { useSafeNavigate } from '@/hooks/useSafeNavigate';
import { useVocabFeedback } from '@/lib/vocab/use-vocab-feedback';
import { LexiArtwork } from './LexiAsset';
import type { BriefingKind } from '@/lib/vocab/briefing';

const BRIEFING_ART: Record<BriefingKind, string> = {
  resume:           'home/recommendation-resume-quiz.webp',
  repeat_offenders: 'home/recommendation-repair-weak.webp',
  deadline_file:    'home/study-deadline.svg',
  fresh:            'home/recommendation-learn-new.webp',
};

const BRIEFING_ACCENT: Record<BriefingKind, string> = {
  resume:           'var(--color-lx-accent-red)',
  repeat_offenders: 'var(--color-lx-accent-red)',
  deadline_file:    '#5BA3F5',
  fresh:            'var(--color-lx-accent-gold)',
};

export interface BriefingCardData {
  kind:            BriefingKind;
  title:           string;
  subtitle:        string;
  href:            string;
  wordCount:       number;
  durationMinutes: number;
}

export function BriefingSection({
  label, cards,
}: { label: string; cards: BriefingCardData[] }) {
  if (cards.length === 0) return null;
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <p style={{
        fontFamily:    "'Sora', sans-serif",
        fontSize:      '0.58rem',
        fontWeight:    600,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color:         'var(--color-lx-text-muted)',
        margin:        '0 0 0.625rem',
      }}>
        {label}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {cards.map((card, i) => (
          <BriefingCardRow key={`${card.kind}-${card.href}`} card={card} delay={i * 0.07} />
        ))}
      </div>
    </div>
  );
}

function BriefingCardRow({ card, delay }: { card: BriefingCardData; delay: number }) {
  const { navigate } = useSafeNavigate();
  const fb           = useVocabFeedback();
  const accent       = BRIEFING_ACCENT[card.kind];

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring' as const, stiffness: 340, damping: 28 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => { fb.play('tap'); navigate(card.href); }}
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          12,
        width:        '100%',
        textAlign:    'left',
        padding:      '0.625rem 0.75rem',
        borderRadius: 12,
        cursor:       'pointer',
        background:   'var(--color-lx-surface)',
        border:       `1px solid ${accent}30`,
      }}
    >
      <span style={{
        flexShrink:   0,
        width:        38,
        height:       38,
        borderRadius: 10,
        overflow:     'hidden',
      }}>
        <LexiArtwork path={BRIEFING_ART[card.kind]} width={38} height={38} loading="eager" />
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily:   "'Cormorant Garamond', Georgia, serif",
          fontStyle:    'italic',
          fontWeight:   600,
          fontSize:     '1rem',
          lineHeight:   1.25,
          color:        'var(--color-lx-text-primary)',
          margin:       0,
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}>
          {card.title}
        </p>
        <p style={{
          fontFamily:   "'Sora', sans-serif",
          fontSize:     '0.68rem',
          color:        'var(--color-lx-text-muted)',
          margin:       '2px 0 0',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}>
          {card.subtitle}
        </p>
      </div>

      <div style={{
        display:    'flex',
        alignItems: 'center',
        gap:        4,
        flexShrink: 0,
        color:      'var(--color-lx-text-muted)',
        fontFamily: "'Sora', sans-serif",
        fontSize:   '0.62rem',
      }}>
        <Clock3 size={11} aria-hidden />
        {card.durationMinutes}m
      </div>
    </motion.button>
  );
}

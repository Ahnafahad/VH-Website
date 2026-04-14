'use client';

import { motion } from 'framer-motion';

interface Props {
  icon: React.ReactNode;
  label: string;
  title: string;
  children: React.ReactNode;
  description: string;
  subtext?: string;
  ctaLabel: string;
  ctaDisabled: boolean;
  onCta: () => void;
  stepLabel: string;
}

const demoZoneBg =
  'linear-gradient(145deg, rgba(230,57,70,0.06) 0%, rgba(26,26,26,0.95) 50%, rgba(244,168,40,0.04) 100%)';

export default function DemoSlideLayout({
  icon,
  label,
  title,
  children,
  description,
  subtext,
  ctaLabel,
  ctaDisabled,
  onCta,
  stepLabel,
}: Props) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      {/* Icon in glow circle */}
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full"
        style={{
          background: 'rgba(230,57,70,0.12)',
          color:      'var(--color-lx-accent-red)',
        }}
      >
        {icon}
      </div>

      {/* Section label */}
      <p
        style={{
          fontFamily:    "'Sora', sans-serif",
          fontSize:      '0.65rem',
          fontWeight:    600,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color:         'var(--color-lx-text-muted)',
          margin:        '-0.5rem 0 -0.25rem',
        }}
      >
        {label}
      </p>

      {/* Slide title */}
      <h2
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize:   '1.8rem',
          fontWeight: 600,
          fontStyle:  'italic',
          color:      'var(--color-lx-text-primary)',
          lineHeight: 1.15,
          margin:     0,
        }}
      >
        {title}
      </h2>

      {/* Demo zone */}
      <div
        className="flex w-full flex-col items-center justify-center overflow-hidden rounded-2xl px-4 py-6"
        style={{
          background: demoZoneBg,
          border:     '1px solid var(--color-lx-border)',
          minHeight:  200,
        }}
      >
        {children}
      </div>

      {/* Description */}
      <p
        className="text-left"
        style={{
          fontFamily: "'Sora', sans-serif",
          fontSize:   '0.85rem',
          fontWeight: 400,
          color:      'var(--color-lx-text-secondary)',
          lineHeight: 1.6,
          margin:     0,
        }}
      >
        {description}
      </p>

      {/* Subtext */}
      {subtext && (
        <p
          className="text-left"
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize:   '0.75rem',
            fontWeight: 400,
            fontStyle:  'italic',
            color:      'var(--color-lx-text-muted)',
            lineHeight: 1.5,
            margin:     '-0.25rem 0 0',
          }}
        >
          {subtext}
        </p>
      )}

      {/* CTA */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={onCta}
        disabled={ctaDisabled}
        className="w-full rounded-xl py-3.5 text-base font-semibold text-white"
        style={{
          background: ctaDisabled
            ? 'var(--color-lx-elevated)'
            : 'linear-gradient(135deg, var(--color-lx-accent-red) 0%, #c42d39 100%)',
          fontFamily: "'Sora', sans-serif",
          opacity:    ctaDisabled ? 0.5 : 1,
          cursor:     ctaDisabled ? 'not-allowed' : 'pointer',
          boxShadow:  ctaDisabled ? 'none' : '0 4px 20px rgba(230,57,70,0.35)',
          transition: 'opacity 0.25s, background 0.25s, box-shadow 0.25s',
        }}
      >
        {ctaLabel}
      </motion.button>

      {/* Step label */}
      <p
        style={{
          fontFamily: "'Sora', sans-serif",
          fontSize:   '0.65rem',
          color:      'var(--color-lx-text-muted)',
          margin:     '-0.25rem 0 0',
        }}
      >
        {stepLabel}
      </p>
    </div>
  );
}

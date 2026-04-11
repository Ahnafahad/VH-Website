'use client';

/**
 * DeadlineBanner — T35 Edge Case 1
 *
 * Appears at the top of the home screen when the user's deadline has passed.
 * Warm crimson-amber tinted inline alert with a CTA to update the deadline.
 *
 * Framer Motion: y: -8 → 0, fade in, spring.
 */

import { motion, type Variants } from 'framer-motion';
import { CalendarX, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

const bannerV: Variants = {
  hidden: { opacity: 0, y: -8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 380, damping: 30 },
  },
};

export default function DeadlineBanner() {
  const router = useRouter();

  return (
    <motion.div
      variants={bannerV}
      initial="hidden"
      animate="show"
      role="alert"
      aria-live="polite"
      style={{
        background:   'rgba(214, 43, 56, 0.08)',
        border:       '1px solid rgba(214, 43, 56, 0.22)',
        borderRadius: '14px',
        padding:      '14px 16px',
        display:      'flex',
        alignItems:   'flex-start',
        gap:          '12px',
      }}
    >
      {/* Icon */}
      <div
        aria-hidden
        style={{
          flexShrink:     0,
          width:          32,
          height:         32,
          borderRadius:   '8px',
          background:     'rgba(214, 43, 56, 0.14)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          marginTop:      '1px',
        }}
      >
        <CalendarX
          size={16}
          strokeWidth={1.8}
          style={{ color: 'var(--color-lx-accent-red)' }}
        />
      </div>

      {/* Text block */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize:   '13px',
            fontWeight: 600,
            color:      'var(--color-lx-text-primary)',
            margin:     '0 0 3px',
            lineHeight: 1.3,
          }}
        >
          Your target date has passed.
        </p>
        <p
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize:   '11.5px',
            fontWeight: 400,
            color:      'var(--color-lx-text-secondary)',
            margin:     0,
            lineHeight: 1.45,
          }}
        >
          Update your deadline to get back on track.
        </p>
      </div>

      {/* CTA */}
      <motion.button
        whileTap={{ scale: 0.93 }}
        onClick={() => router.push('/vocab/profile?tab=settings')}
        aria-label="Update deadline"
        style={{
          flexShrink:    0,
          display:       'flex',
          alignItems:    'center',
          gap:           '4px',
          fontFamily:    "'Sora', sans-serif",
          fontSize:      '11px',
          fontWeight:    600,
          letterSpacing: '0.06em',
          color:         'var(--color-lx-accent-red)',
          background:    'rgba(214, 43, 56, 0.12)',
          border:        '1px solid rgba(214, 43, 56, 0.28)',
          borderRadius:  '8px',
          padding:       '7px 11px',
          cursor:        'pointer',
          whiteSpace:    'nowrap',
          marginTop:     '1px',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(214, 43, 56, 0.2)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(214, 43, 56, 0.12)';
        }}
      >
        Update
        <ArrowRight size={12} strokeWidth={2.2} />
      </motion.button>
    </motion.div>
  );
}

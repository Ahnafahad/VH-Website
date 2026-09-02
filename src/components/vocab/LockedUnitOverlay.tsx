'use client';

/**
 * LockedUnitOverlay — T35 Edge Case 3
 *
 * Renders in place of a locked unit's accordion (the whole unit is gated —
 * there's nothing inside to open). Previously this was absolutely positioned
 * on top of the accordion's collapsed header, but the header is far shorter
 * than the gate's content, so it got clipped by the card's `overflow:hidden`.
 * Rendering it as a normal-flow card sidesteps that entirely.
 *
 * Tapping opens a bottom sheet to request full access.
 */

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import AccessRequestSheet from './AccessRequestSheet';
import { LexiArtwork } from '@/components/vocab/LexiAsset';

interface Props {
  /** Unit name to display in the card and the bottom sheet header */
  unitName?: string;
}

export default function LockedUnitOverlay({ unitName = 'this unit' }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mounted,   setMounted]   = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => { setMounted(true); }, []);

  const openSheet  = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  return (
    <>
      <motion.div
        initial={shouldReduceMotion ? undefined : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="overflow-hidden rounded-2xl"
        style={{
          position:   'relative',
          background: 'linear-gradient(135deg, var(--color-lx-surface) 0%, rgba(20,20,20,0.9) 100%)',
          border:     '1px solid rgba(201,168,76,0.18)',
        }}
      >
        <div
          onClick={openSheet}
          role="button"
          aria-label={`Request access to unlock ${unitName}`}
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSheet(); } }}
          style={{
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            gap:            '12px',
            padding:        '22px 20px',
            cursor:         'pointer',
            textAlign:      'center',
          }}
        >
          <div style={{ position: 'relative', width: 56, height: 56 }}>
            {!shouldReduceMotion && (
              <motion.div
                animate={{ opacity: [0.35, 0.7, 0.35] }}
                transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
                style={{
                  position:   'absolute',
                  inset:      -5,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(201,168,76,0.35) 0%, transparent 70%)',
                }}
              />
            )}
            <div
              style={{
                position:       'relative',
                width:          56,
                height:         56,
                borderRadius:   '50%',
                background:     'rgba(201,168,76,0.12)',
                border:         '1px solid rgba(201,168,76,0.35)',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
              }}
            >
              <LexiArtwork path="states/content-locked.webp" width={50} height={50} />
            </div>
          </div>

          <div>
            <p
              style={{
                fontFamily:  "'Cormorant Garamond', Georgia, serif",
                fontSize:    '1.1rem',
                fontWeight:  700,
                fontStyle:   'italic',
                color:       'var(--color-lx-text-primary)',
                margin:      '0 0 4px',
                lineHeight:  1.25,
              }}
            >
              {unitName}
            </p>
            <p
              style={{
                fontFamily:  "'Sora', sans-serif",
                fontSize:    '11.5px',
                fontWeight:  400,
                color:       'var(--color-lx-text-muted)',
                margin:      0,
                lineHeight:  1.5,
                maxWidth:    240,
              }}
            >
              Requires full LexiCore access to unlock.
            </p>
          </div>

          <div
            style={{
              display:       'flex',
              alignItems:    'center',
              gap:           '5px',
              fontFamily:    "'Sora', sans-serif",
              fontSize:      '11px',
              fontWeight:    600,
              letterSpacing: '0.08em',
              color:         '#C9A84C',
              background:    'rgba(201,168,76,0.12)',
              border:        '1px solid rgba(201,168,76,0.32)',
              borderRadius:  '8px',
              padding:       '7px 14px',
            }}
          >
            Request Access
            <ChevronRight size={12} strokeWidth={2.2} />
          </div>
        </div>
      </motion.div>

      {mounted && createPortal(
        <AnimatePresence>
          {sheetOpen && (
            <AccessRequestSheet
              key="access-sheet"
              title="Request Full Access"
              subtitle={`to unlock ${unitName}`}
              onClose={closeSheet}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

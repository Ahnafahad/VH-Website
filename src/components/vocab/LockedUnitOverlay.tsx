'use client';

/**
 * LockedUnitOverlay — T35 Edge Case 3
 *
 * Positioned absolute over a locked unit/theme card.
 * Clicking opens a bottom sheet form to request full access.
 *
 * Design: gold-accented lock gate. Blurred overlay, gold Lock icon.
 * Bottom sheet: WhatsApp input + optional message, submits to POST /api/vocab/access-request.
 */

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import { Lock, ChevronRight } from 'lucide-react';
import AccessRequestSheet from './AccessRequestSheet';

interface Props {
  /** Unit name to display in the bottom sheet header */
  unitName?: string;
}

export default function LockedUnitOverlay({ unitName = 'this unit' }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mounted,   setMounted]   = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const openSheet  = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setSheetOpen(true);
  }, []);

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  return (
    <>
      <div
        style={{
          position:       'absolute',
          inset:          0,
          borderRadius:   'inherit',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          background:     'rgba(10,8,6,0.72)',
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            '10px',
          zIndex:         10,
          cursor:         'pointer',
          padding:        '16px',
        }}
        onClick={openSheet}
        role="button"
        aria-label={`Request access to unlock ${unitName}`}
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSheetOpen(true); } }}
      >
        <div
          style={{
            width:          40,
            height:         40,
            borderRadius:   '50%',
            background:     'rgba(201,168,76,0.12)',
            border:         '1px solid rgba(201,168,76,0.35)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            boxShadow:      '0 0 16px rgba(201,168,76,0.2)',
          }}
        >
          <Lock
            size={18}
            strokeWidth={1.6}
            style={{
              color:  '#C9A84C',
              filter: 'drop-shadow(0 0 4px rgba(201,168,76,0.6))',
            }}
          />
        </div>

        <div style={{ textAlign: 'center' }}>
          <p
            style={{
              fontFamily:  "'Sora', sans-serif",
              fontSize:    '12px',
              fontWeight:  600,
              color:       'var(--color-lx-text-primary)',
              margin:      '0 0 3px',
              lineHeight:  1.3,
            }}
          >
            Full Access Required
          </p>
          <p
            style={{
              fontFamily:  "'Sora', sans-serif",
              fontSize:    '10.5px',
              fontWeight:  400,
              color:       'var(--color-lx-text-muted)',
              margin:      0,
              lineHeight:  1.4,
            }}
          >
            This content requires full LexiCore access.
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

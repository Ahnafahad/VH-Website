'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronRight } from 'lucide-react';
import AccessRequestSheet from './AccessRequestSheet';

interface Props {
  /** How many additional words are currently blurred */
  lockedCount: number;
  /** How many words are already unlocked */
  unlockedCount: number;
}

export default function UnlockAllWordsBanner({ lockedCount, unlockedCount }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mounted,   setMounted]   = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const open  = useCallback(() => setSheetOpen(true),  []);
  const close = useCallback(() => setSheetOpen(false), []);

  const total = lockedCount + unlockedCount;

  return (
    <>
      <motion.button
        onClick={open}
        whileTap={{ scale: 0.98 }}
        whileHover={{ scale: 1.01 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        style={{
          width:         '100%',
          display:       'flex',
          alignItems:    'center',
          gap:           '0.75rem',
          padding:       '0.875rem 1rem',
          borderRadius:  14,
          background:    'linear-gradient(135deg, rgba(201,168,76,0.14) 0%, rgba(201,168,76,0.06) 100%)',
          border:        '1px solid rgba(201,168,76,0.32)',
          cursor:        'pointer',
          textAlign:     'left',
          boxShadow:     '0 1px 12px rgba(201,168,76,0.08)',
        }}
      >
        <div
          style={{
            width:          34,
            height:         34,
            borderRadius:   '50%',
            background:     'rgba(201,168,76,0.16)',
            border:         '1px solid rgba(201,168,76,0.35)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            flexShrink:     0,
          }}
        >
          <Sparkles
            size={15}
            strokeWidth={1.7}
            style={{
              color:  '#C9A84C',
              filter: 'drop-shadow(0 0 3px rgba(201,168,76,0.55))',
            }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontFamily: "'Sora', sans-serif",
              fontSize:   '0.8125rem',
              fontWeight: 600,
              color:      'var(--color-lx-text-primary)',
              margin:     '0 0 2px',
              lineHeight: 1.2,
            }}
          >
            Unlock all words
          </p>
          <p
            style={{
              fontFamily: "'Sora', sans-serif",
              fontSize:   '0.6875rem',
              fontWeight: 400,
              color:      'var(--color-lx-text-muted)',
              margin:     0,
              lineHeight: 1.35,
            }}
          >
            Preview {unlockedCount} of {total}. Unlock the remaining {lockedCount}.
          </p>
        </div>

        <ChevronRight size={16} strokeWidth={2} style={{ color: '#C9A84C', flexShrink: 0 }} />
      </motion.button>

      {mounted && createPortal(
        <AnimatePresence>
          {sheetOpen && (
            <AccessRequestSheet
              key="unlock-sheet"
              title="Unlock all words"
              subtitle={`${lockedCount} more words waiting`}
              onClose={close}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

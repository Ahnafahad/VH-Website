'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import DemoSlides from '../../onboarding/demo/DemoSlides';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function DemoModal({ open, onClose }: Props) {
  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  if (typeof window === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto"
          style={{ background: 'var(--color-lx-base)' }}
        >
          <div className="w-full max-w-sm px-5 py-10">
            <DemoSlides
              mode="replay"
              onComplete={onClose}
              onClose={onClose}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

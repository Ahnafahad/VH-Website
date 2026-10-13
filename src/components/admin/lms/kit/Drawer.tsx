'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useDialogBehaviour } from '../lms-shared';
import {
  SLATE, BORDER, BG, SURFACE, INK_SOFT, FONT_HEADING, Z_MODAL, Z_MODAL_BACKDROP, T_LG,
} from '../tokens';

/**
 * Right-hand drawer. Same dialog behaviour as Modal (focus trap, Escape, body
 * scroll lock, focus returns to the opener) but anchored to the edge so the
 * list behind it keeps its place. Motion is transform/opacity only;
 * MotionConfig in the admin layout switches it off under reduced-motion.
 */
export function Drawer({
  open, onClose, title, children, width = 480, confirmClose,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: number;
  /** Optional guard (e.g. unsaved form); resolve false to keep the drawer open. */
  confirmClose?: () => boolean | Promise<boolean>;
}) {
  const labelId = React.useId();
  const requestClose = async () => {
    if (confirmClose && !(await confirmClose())) return;
    onClose();
  };
  const panelRef = useDialogBehaviour(open, () => void requestClose());

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => void requestClose()}
            style={{ position: 'fixed', inset: 0, background: 'rgba(26,5,7,0.28)', zIndex: Z_MODAL_BACKDROP }}
          />
          <motion.div
            key="drawer-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelId}
            className="kit-drawer"
            initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: Z_MODAL,
              width, maxWidth: '100vw', background: SURFACE, borderLeft: `1px solid ${BORDER}`,
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              padding: '14px 16px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0,
            }}>
              <span id={labelId} style={{ fontFamily: FONT_HEADING, fontSize: T_LG, fontWeight: 700, color: SLATE, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {title}
              </span>
              <button
                type="button"
                className="lms-iconbtn"
                onClick={() => void requestClose()}
                aria-label="Close"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40,
                  borderRadius: '50%', border: `1px solid ${BORDER}`, background: BG, color: INK_SOFT, cursor: 'pointer', flexShrink: 0,
                }}
              >
                <X size={14} aria-hidden />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, minHeight: 0 }}>{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

'use client';

/**
 * Shared primitives for LMS admin UI.
 * No external UI library — Tailwind + Framer Motion + lucide-react only.
 */

import React from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { X, AlertTriangle, Loader2, Check, ChevronDown } from 'lucide-react';
import { COURSES, SUBJECTS, DOC_TYPES, BATCHES, CourseKey, SubjectKey, DocTypeKey, BatchKey } from '@/lib/naming/taxonomy';

// ─── Design tokens ────────────────────────────────────────────────────────────
// Warm-editorial palette, matching the admin shell (src/app/admin/page.tsx).
// Existing five keep their exact names (imported by name in 7 sibling files) —
// only their values change.

export const RED    = '#760F13';
export const SLATE  = '#1A0507';
export const BORDER = '#E1D4CB';
// Was #9A7060, which failed WCAG AA as body text on all three surfaces it lands
// on (4.32 on SURFACE, 3.99 on BG, 3.72 on SURFACE_ALT — needs 4.5). Darkened
// within the same warm-brown hue: now 5.33 / 4.91 / 4.59.
export const MUTED  = '#8A6250';
export const BG     = '#FAF5EF';

// BORDER is a divider tone (1.45:1 on SURFACE) — fine for card edges and rules,
// which WCAG 1.4.11 exempts, but not for the boundary of a form control, which
// needs 3:1. Fields and the Toggle track use this instead: 3.54 on SURFACE,
// 3.26 on BG. Don't swap it in for dividers; it reads as a heavy line there.
export const BORDER_FIELD = '#9E8371';

export const RED_HOVER   = '#9A1B20';
export const RED_DARK    = '#5A0B0F';
export const INK_SOFT    = '#3D1A10';
export const SURFACE     = '#FFFFFF';
export const SURFACE_ALT = '#F5EDE3';
export const BEIGE       = '#D4B094';

export const OK      = '#2F6B4F';
export const OK_BG   = '#EAF2ED';
export const WARN    = '#8A5A1A';
export const WARN_BG = '#FAF0E2';
export const INFO    = '#2A5A8A';
export const INFO_BG = '#EAF0F6';

export const R_SM   = 6;
export const R_MD   = 8;
export const R_LG   = 10;
export const R_XL   = 14;
export const R_PILL = 999;

export const SHADOW_SM = '0 1px 2px rgba(26,5,7,0.04), 0 1px 3px rgba(26,5,7,0.03)';
export const SHADOW_MD = '0 2px 6px rgba(26,5,7,0.07)';
export const SHADOW_LG = '0 8px 24px rgba(26,5,7,0.12)';

export const FONT_HEADING = "var(--font-heading), Georgia, serif";

// Semantic stacking order. The values used to be written inline (200/201 for
// Modal, 300/301 for ConfirmDialog, 9999 for Toast), which made "what sits on
// top of what" a thing you had to reverse-engineer. Confirm outranks Modal
// because it is raised *from* an open modal; Toast outranks both because it
// reports the result of whatever the dialog just did.
export const Z_MODAL_BACKDROP   = 200;
export const Z_MODAL            = 201;
export const Z_CONFIRM_BACKDROP = 300;
export const Z_CONFIRM          = 301;
export const Z_TOAST            = 400;

// ─── PDF heading extraction ───────────────────────────────────────────────────

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

async function processPdf(arrayBuffer: ArrayBuffer, pdfjsLib: any, resolve: (value: string) => void, reject: (reason?: any) => void) {
  try {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item: any) => item.str)
      .join(' ')
      .trim();

    // Extract the largest/most prominent text (usually the title)
    const lines: string[] = text.split(/[\n\r]+/).map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    // Prefer all-caps lines (usually titles), then pick the longest
    const heading = lines.find((l: string) => l.toUpperCase() === l && l.length > 5) || lines[0] || '';
    resolve(heading.trim());
  } catch (err) {
    reject(new Error(`Failed to extract PDF heading: ${err instanceof Error ? err.message : 'Unknown error'}`));
  }
}

// Extract the cover-page heading from a PDF file using PDF.js from CDN
export async function extractPdfHeading(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        if (!arrayBuffer) throw new Error('Failed to read file');

        // Load PDF.js from CDN
        if (typeof window !== 'undefined' && !(window as any).pdfjsWorkerScript) {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.269/pdf.min.js';
          script.onload = () => {
            (window as any).pdfjsWorkerScript = true;
            const pdfjsLib = (window as any).pdfjsLib;
            if (pdfjsLib) {
              pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.269/pdf.worker.min.js';
              processPdf(arrayBuffer, pdfjsLib, resolve, reject);
            }
          };
          document.head.appendChild(script);
        } else if ((window as any).pdfjsLib) {
          processPdf(arrayBuffer, (window as any).pdfjsLib, resolve, reject);
        }
      } catch (err) {
        reject(new Error(`Failed to extract PDF heading: ${err instanceof Error ? err.message : 'Unknown error'}`));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

// ─── Motion variants ─────────────────────────────────────────────────────────

export const backdropV: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18 } },
  exit:    { opacity: 0, transition: { duration: 0.15, delay: 0.04 } },
};

export const modalV: Variants = {
  hidden:  { opacity: 0, scale: 0.95, y: 14 },
  visible: { opacity: 1, scale: 1, y: 0,
    transition: { type: 'spring' as const, stiffness: 380, damping: 28 } },
  exit:    { opacity: 0, scale: 0.95, y: 8, transition: { duration: 0.16 } },
};

export const rowV: Variants = {
  hidden:  { opacity: 0, y: 6 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    // Capped: the stagger used to be unbounded, so a 40-row materials list made
    // the last row wait 1.2s before it appeared. Beyond ~10 rows the sequence
    // has already read as a sequence; anything later is just latency.
    transition: { type: 'spring' as const, stiffness: 380, damping: 32, delay: Math.min(i, 10) * 0.03 },
  }),
};

// ─── Spin keyframe + shared interactive-state CSS ─────────────────────────────
// hover/:focus-visible rules for the primitives below ride along on the same
// injected tag as the spin keyframe. Every LMS screen must render
// `<style>{SPIN_CSS}</style>` once, or its shared buttons, fields and icon
// buttons silently lose their hover and focus states.

export const SPIN_CSS = `
@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.lms-field{transition:border-color .14s}
.lms-field:hover{border-color:${MUTED}}
.lms-field:focus{border-color:${RED}}
.lms-field:focus-visible{outline:2px solid ${RED};outline-offset:2px}
.lms-btn{transition:background-color .14s,border-color .14s,color .14s}
.lms-btn:focus-visible{outline:2px solid ${RED};outline-offset:2px}
.lms-btn-primary:hover:not(:disabled){background:${RED_HOVER}}
.lms-btn-primary:active:not(:disabled){background:${RED_DARK}}
.lms-btn-danger:hover:not(:disabled){background:${RED}1F;border-color:${RED}4D}
.lms-btn-ghost:hover:not(:disabled){background:${SURFACE_ALT};border-color:${BEIGE}}
.lms-iconbtn{transition:background-color .14s,border-color .14s,color .14s}
.lms-iconbtn:hover:not(:disabled){background:${SURFACE_ALT};border-color:${BEIGE};color:${RED_DARK}}
.lms-iconbtn:focus-visible{outline:2px solid ${RED};outline-offset:2px}
.lms-tab{transition:color .14s,border-color .14s}
.lms-tab:hover{color:${RED_DARK}}
.lms-tab:focus-visible{outline:2px solid ${RED};outline-offset:2px}
.lms-switch{transition:background-color .18s}
.lms-switch:focus-visible{outline:2px solid ${RED};outline-offset:3px}
.lms-switch-knob{transition:transform .18s}
/* The visual boxes stay at their desktop density; on a touch device the hit
   area alone grows to the 44px minimum, so nothing reflows on a mouse. */
@media (pointer:coarse){
.lms-btn{min-height:44px}
.lms-iconbtn{min-width:44px;min-height:44px}
.lms-tab{min-height:44px}
.lms-field{min-height:44px}
/* The switch track stays 20px tall; only the button around it grows, so the
   row gains height on touch without the control itself changing shape. */
.lms-switch{min-height:44px}
}
/* Framer-motion's side of this is handled once by MotionConfig in the admin
   layout. The loading spinner is deliberately left spinning — it reports status
   rather than decorating, and freezing it would remove the only signal that
   work is in flight. */
@media (prefers-reduced-motion:reduce){
.lms-field,.lms-btn,.lms-iconbtn,.lms-tab,.lms-switch,.lms-switch-knob{transition-duration:.01ms}
}
`;

// ─── Subject badge ────────────────────────────────────────────────────────────

const subjectColors: Record<string, { bg: string; color: string; border: string }> = {
  english:    { bg: `${INFO}14`, color: INFO, border: `${INFO}33` },
  math:       { bg: `${OK}14`,   color: OK,   border: `${OK}33`   },
  analytical: { bg: `${WARN}17`, color: WARN, border: `${WARN}40` },
};

export function SubjectBadge({ subject }: { subject: string }) {
  const s = subjectColors[subject] ?? { bg: SURFACE_ALT, color: INK_SOFT, border: BORDER };
  return (
    <span style={{
      display:       'inline-flex',
      alignItems:    'center',
      padding:       '2px 8px',
      borderRadius:  R_PILL,
      fontSize:      11,
      fontWeight:    600,
      letterSpacing: '0.01em',
      lineHeight:    1.6,
      background:    s.bg,
      color:         s.color,
      border:        `1px solid ${s.border}`,
      textTransform: 'capitalize',
    }}>
      {subject}
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const statusColors: Record<string, { bg: string; color: string; border: string }> = {
  draft:     { bg: SURFACE_ALT,  color: MUTED,    border: BORDER      },
  scheduled: { bg: `${INFO}14`,  color: INFO,     border: `${INFO}33` },
  live:      { bg: `${OK}17`,    color: OK,       border: `${OK}40`   },
  completed: { bg: SURFACE_ALT,  color: INK_SOFT, border: BORDER      },
  cancelled: { bg: `${RED}14`,   color: RED_DARK, border: `${RED}33`  },
};

export function StatusBadge({ status }: { status: string }) {
  const s = statusColors[status] ?? statusColors.draft;
  return (
    <span style={{
      display:       'inline-flex',
      alignItems:    'center',
      gap:           4,
      padding:       '2px 8px',
      borderRadius:  R_PILL,
      fontSize:      11,
      fontWeight:    600,
      letterSpacing: '0.01em',
      lineHeight:    1.6,
      background:    s.bg,
      color:         s.color,
      border:        `1px solid ${s.border}`,
      textTransform: 'capitalize',
    }}>
      {status === 'live' && (
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: OK, flexShrink: 0,
        }} />
      )}
      {status}
    </span>
  );
}

// ─── Dialog behaviour ─────────────────────────────────────────────────────────
// Modal and ConfirmDialog are hand-built overlays, not <dialog>, so everything
// the platform would give for free has to be wired here: without it, Tab walks
// the page behind the backdrop, Escape does nothing, and closing drops focus on
// <body> instead of returning it to the control that opened the dialog.

// Only the topmost dialog may answer Escape. ConfirmDialog is routinely raised
// from inside an open Modal (`confirmClose`), and both listen on `document` —
// without this, one Escape would cancel the confirm *and* close the modal
// underneath it, which is the opposite of what the confirm is protecting.
const dialogStack: symbol[] = [];
let savedBodyOverflow = '';

function useDialogBehaviour(open: boolean, onEscape: () => void) {
  const ref = React.useRef<HTMLDivElement>(null);
  // Held in a ref so a new closure from the parent's re-render doesn't re-run
  // the effect and re-steal focus mid-edit.
  const escapeRef = React.useRef(onEscape);
  escapeRef.current = onEscape;

  React.useEffect(() => {
    if (!open) return;
    const id = Symbol('dialog');
    dialogStack.push(id);
    const opener = document.activeElement as HTMLElement | null;

    const SELECTOR = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const focusable = () =>
      Array.from(ref.current?.querySelectorAll<HTMLElement>(SELECTOR) ?? [])
        .filter(el => el.offsetParent !== null);

    // A frame late on purpose — the panel animates in, and querying before the
    // first paint finds nothing to focus.
    const raf = requestAnimationFrame(() => (focusable()[0] ?? ref.current)?.focus());

    const onKeyDown = (e: KeyboardEvent) => {
      if (dialogStack[dialogStack.length - 1] !== id) return;
      if (e.key === 'Escape') { e.preventDefault(); escapeRef.current(); return; }
      if (e.key !== 'Tab') return;
      const els = focusable();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown, true);

    // Scroll lock belongs to the stack, not to each dialog. Confirming a discard
    // unmounts the confirm and the modal in one commit, and React runs the two
    // cleanups in tree order — if each restored the value it captured on open,
    // the confirm's 'hidden' would land last and leave the page unscrollable.
    if (dialogStack.length === 1) {
      savedBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown, true);
      dialogStack.splice(dialogStack.indexOf(id), 1);
      if (dialogStack.length === 0) document.body.style.overflow = savedBodyOverflow;
      opener?.focus?.();
    };
  }, [open]);

  return ref;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

export function Toast({ message, onDismiss }: { message: string | null; onDismiss?: () => void }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          role="status"
          aria-live="polite"
          style={{
            position:     'fixed',
            bottom:       24,
            left:         '50%',
            transform:    'translateX(-50%)',
            zIndex:       Z_TOAST,
            padding:      '10px 20px',
            borderRadius: R_MD,
            background:   SLATE,
            color:        SURFACE,
            fontSize:     13,
            fontWeight:   500,
            boxShadow:    SHADOW_LG,
            // Was `nowrap`, which pushed longer messages (API errors, filenames)
            // off both edges of a phone screen with no way to read them.
            maxWidth:     'calc(100vw - 32px)',
            display:      'flex',
            alignItems:   'center',
            gap:          8,
          }}
        >
          {message}
          {onDismiss && (
            <button onClick={onDismiss} className="lms-iconbtn" style={{ background: 'none', border: 'none', borderRadius: R_SM, cursor: 'pointer', color: 'rgba(255,255,255,0.6)', padding: 2 }}>
              <X size={12} aria-hidden />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

export function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  destructive = false, loading = false, onConfirm, onCancel,
}: {
  open: boolean; title: string; message: string;
  confirmLabel?: string;
  /** Override when the default would be ambiguous — e.g. a "Cancel this slot?"
   *  dialog, where a "Cancel" dismiss button reads as the action itself. */
  cancelLabel?: string;
  destructive?: boolean; loading?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  const labelId = React.useId();
  const descId = React.useId();
  // Escape is ignored mid-request for the same reason Cancel is disabled: the
  // action is already in flight and dismissing the dialog would hide its result.
  const panelRef = useDialogBehaviour(open, () => { if (!loading) onCancel(); });

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            variants={backdropV} initial="hidden" animate="visible" exit="exit"
            onClick={onCancel}
            style={{ position: 'fixed', inset: 0, background: 'rgba(26,5,7,0.35)', zIndex: Z_CONFIRM_BACKDROP }}
          />
          <motion.div
            ref={panelRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={labelId}
            aria-describedby={descId}
            variants={modalV} initial="hidden" animate="visible" exit="exit"
            style={{
              position: 'fixed', top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              zIndex: Z_CONFIRM, background: SURFACE, borderRadius: R_LG,
              padding: '24px 28px', width: 340, maxWidth: '92vw',
              boxShadow: SHADOW_LG,
              border: `1px solid ${BORDER}`,
            }}
          >
            <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: destructive ? `${RED}1A` : `${INFO}1A`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AlertTriangle size={17} style={{ color: destructive ? RED : INFO }} aria-hidden />
              </div>
              <div>
                <p id={labelId} style={{ margin: 0, fontFamily: FONT_HEADING, fontSize: 15, fontWeight: 700, color: SLATE, lineHeight: 1.3 }}>{title}</p>
                <p id={descId} style={{ margin: '4px 0 0', fontSize: 13, color: MUTED, lineHeight: 1.45 }}>{message}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <motion.button onClick={onCancel} whileTap={{ scale: 0.97 }} disabled={loading} className="lms-btn lms-btn-ghost" style={{
                padding: '8px 16px', borderRadius: R_MD, fontSize: 13, fontWeight: 500,
                border: `1px solid ${BORDER}`, background: SURFACE, color: INK_SOFT,
                cursor: 'pointer', opacity: loading ? 0.5 : 1,
              }}>{cancelLabel}</motion.button>
              <motion.button onClick={onConfirm} whileTap={{ scale: 0.97 }} disabled={loading} className={`lms-btn ${destructive ? 'lms-btn-danger' : 'lms-btn-primary'}`} style={{
                padding: '8px 16px', borderRadius: R_MD, fontSize: 13, fontWeight: 600,
                border: 'none', background: destructive ? RED_DARK : RED, color: SURFACE,
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {loading && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} aria-hidden />}
                {confirmLabel}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Imperative confirm helper ────────────────────────────────────────────────
// Wraps ConfirmDialog for call sites that need a promise (e.g. a Modal's
// `confirmClose`, or an onClick handler that used to be `if (!confirm(...))`).
// Usage: `const [confirm, confirmDialog] = useConfirm();` then
// `if (!(await confirm({ title, message }))) return;`, and render
// `{confirmDialog}` once somewhere in the component's JSX output.

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export function useConfirm(): [(opts: ConfirmOptions) => Promise<boolean>, React.ReactNode] {
  const [state, setState] = React.useState<ConfirmOptions | null>(null);
  const resolveRef = React.useRef<((value: boolean) => void) | null>(null);

  const confirm = React.useCallback((opts: ConfirmOptions) => {
    setState(opts);
    return new Promise<boolean>(resolve => { resolveRef.current = resolve; });
  }, []);

  const settle = (value: boolean) => {
    setState(null);
    resolveRef.current?.(value);
    resolveRef.current = null;
  };

  const dialog = (
    <ConfirmDialog
      open={state !== null}
      title={state?.title ?? ''}
      message={state?.message ?? ''}
      confirmLabel={state?.confirmLabel}
      cancelLabel={state?.cancelLabel}
      destructive={state?.destructive}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );

  return [confirm, dialog];
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

export function Modal({
  open, onClose, title, children, width = 560, confirmClose,
}: {
  open: boolean; onClose: () => void; title: string;
  children: React.ReactNode; width?: number;
  /** If provided, backdrop/X call this first and only close on a truthy (or resolved-truthy) result. */
  confirmClose?: () => boolean | Promise<boolean>;
}) {
  const labelId = React.useId();

  const requestClose = async () => {
    if (confirmClose) {
      const ok = await confirmClose();
      if (!ok) return;
    }
    onClose();
  };

  const panelRef = useDialogBehaviour(open, () => void requestClose());

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="modal-backdrop"
            variants={backdropV} initial="hidden" animate="visible" exit="exit"
            onClick={() => void requestClose()}
            style={{ position: 'fixed', inset: 0, background: 'rgba(26,5,7,0.28)', zIndex: Z_MODAL_BACKDROP }}
          />
          <motion.div
            key="modal-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelId}
            variants={modalV} initial="hidden" animate="visible" exit="exit"
            transformTemplate={(_, generated) => `translate(-50%, -50%) ${generated}`}
            style={{
              position: 'fixed', top: '50%', left: '50%',
              zIndex: Z_MODAL, background: SURFACE, borderRadius: R_LG,
              width, maxWidth: 'calc(100vw - 32px)', maxHeight: '90vh',
              display: 'flex', flexDirection: 'column',
              boxShadow: SHADOW_LG,
              border: `1px solid ${BORDER}`,
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: `1px solid ${BORDER}`,
              position: 'sticky', top: 0, background: SURFACE, borderRadius: `${R_LG}px ${R_LG}px 0 0`,
              flexShrink: 0,
            }}>
              <span id={labelId} style={{ fontFamily: FONT_HEADING, fontSize: 16, fontWeight: 700, color: SLATE, letterSpacing: '-0.01em' }}>
                {title}
              </span>
              <motion.button
                onClick={() => void requestClose()} whileTap={{ scale: 0.92 }}
                className="lms-iconbtn"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: '50%',
                  border: `1px solid ${BORDER}`, background: BG,
                  cursor: 'pointer', color: INK_SOFT,
                }}
                aria-label="Close"
              >
                <X size={13} aria-hidden />
              </motion.button>
            </div>
            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', minHeight: 0 }}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// `Modal`'s body is the scroll container, so a form's action row scrolls out of
// reach whenever the form is taller than the panel — the buttons look cut off at
// the bottom edge. This pins them there instead. The negative margins let the
// bar bleed over the body's 20px padding so scrolled content passes behind it,
// and `bottom` cancels that same padding, which otherwise holds the sticky
// anchor 20px clear of the panel's bottom edge and leaves a sliver of form
// showing underneath. Both track `Modal`'s body padding — change them together.
export function FormActions({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'sticky', bottom: -20, zIndex: 1,
      display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center',
      margin: '4px -20px -20px', padding: '12px 20px',
      background: SURFACE, borderTop: `1px solid ${BORDER}`,
      borderRadius: `0 0 ${R_LG}px ${R_LG}px`,
    }}>
      {children}
    </div>
  );
}

// ─── Form field helpers ───────────────────────────────────────────────────────

/**
 * `htmlFor` is optional only because most existing call sites predate it. Pass
 * it (with a matching `id` on the field) wherever you touch a form — without
 * the pair, a screen reader announces the input as unlabelled and clicking the
 * label does nothing.
 */
export function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} style={{
      display: 'block', fontSize: 11, fontWeight: 700, color: MUTED,
      letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 5,
    }}>
      {children}
    </label>
  );
}

export function FieldInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`lms-field${props.className ? ` ${props.className}` : ''}`}
      style={{
        width: '100%', boxSizing: 'border-box',
        padding: '9px 12px', borderRadius: R_MD,
        border: `1.5px solid ${BORDER_FIELD}`, background: BG,
        fontSize: 13, color: SLATE, outline: 'none',
        ...props.style,
      }}
    />
  );
}

export function FieldTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`lms-field${props.className ? ` ${props.className}` : ''}`}
      style={{
        width: '100%', boxSizing: 'border-box',
        padding: '9px 12px', borderRadius: R_MD,
        border: `1.5px solid ${BORDER_FIELD}`, background: BG,
        fontSize: 13, color: SLATE, outline: 'none',
        resize: 'vertical', minHeight: 80,
        ...props.style,
      }}
    />
  );
}

export function FieldSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        {...props}
        className={`lms-field${props.className ? ` ${props.className}` : ''}`}
        style={{
          width: '100%', boxSizing: 'border-box',
          appearance: 'none', padding: '9px 36px 9px 12px', borderRadius: R_MD,
          border: `1.5px solid ${BORDER_FIELD}`, background: BG,
          fontSize: 13, color: SLATE, cursor: 'pointer', outline: 'none',
          ...props.style,
        }}
      />
      <ChevronDown size={13} style={{
        position: 'absolute', right: 10, top: '50%',
        transform: 'translateY(-50%)', color: MUTED, pointerEvents: 'none',
      }} aria-hidden />
    </div>
  );
}

// ─── Taxonomy-driven selects ──────────────────────────────────────────────────
// Course/Subject/DocType/Batch selects, sourced from src/lib/naming/taxonomy.ts
// so the option lists stay in one place.

interface TaxonomySelectProps<K extends string> {
  value: K;
  onChange: (value: K) => void;
  label?: string;
}

function TaxonomySelect<K extends string>({
  options, value, onChange, label,
}: TaxonomySelectProps<K> & { options: readonly { key: K; label: string }[] }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <FieldSelect value={value} onChange={e => onChange(e.target.value as K)}>
        {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
      </FieldSelect>
    </div>
  );
}

export function CourseSelect({ value, onChange, label = 'Course' }: TaxonomySelectProps<CourseKey>) {
  return <TaxonomySelect options={COURSES} value={value} onChange={onChange} label={label} />;
}

export function SubjectSelect({ value, onChange, label = 'Subject' }: TaxonomySelectProps<SubjectKey>) {
  return <TaxonomySelect options={SUBJECTS} value={value} onChange={onChange} label={label} />;
}

export function DocTypeSelect({ value, onChange, label = 'Doc Type' }: TaxonomySelectProps<DocTypeKey>) {
  return <TaxonomySelect options={DOC_TYPES} value={value} onChange={onChange} label={label} />;
}

/**
 * Batch picker. `null` is a real, load-bearing value — schema documents
 * `batch: null` as "all batches", and src/lib/lms/access.ts grants a student
 * access when `batch IS NULL OR batch = user.batch`. Students with no batch of
 * their own can ONLY see null-batch rows, so silently coercing null to a
 * concrete batch hides content from them. Never drop the "All batches" option.
 */
export function BatchSelect({ value, onChange, label = 'Batch' }: {
  value: BatchKey | null;
  onChange: (value: BatchKey | null) => void;
  label?: string;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <FieldSelect
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : e.target.value as BatchKey)}
      >
        <option value="">All batches</option>
        {BATCHES.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
      </FieldSelect>
    </div>
  );
}

const LAST_USED_BATCH_KEY = 'vh-lms-last-used-batch';

/** Read the batch the current admin last used, if any (opt-in — not called automatically). */
export function getLastUsedBatch(): BatchKey | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(LAST_USED_BATCH_KEY) as BatchKey | null;
}

/** Persist the batch the current admin just used, for getLastUsedBatch() to pick up next time. */
export function setLastUsedBatch(batch: BatchKey): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_USED_BATCH_KEY, batch);
}

// ─── Primary / ghost buttons ──────────────────────────────────────────────────

export function PrimaryBtn({
  children, onClick, disabled, loading, type = 'button', small,
}: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
  loading?: boolean; type?: 'button' | 'submit'; small?: boolean;
}) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      whileTap={{ scale: 0.97 }}
      className="lms-btn lms-btn-primary"
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: small ? '6px 12px' : '9px 18px',
        borderRadius: R_MD, border: 'none', background: RED,
        color: SURFACE, fontSize: small ? 12 : 13, fontWeight: 600,
        cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
        opacity: (disabled || loading) ? 0.6 : 1,
        letterSpacing: '-0.01em',
      }}
    >
      {loading && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} aria-hidden />}
      {children}
    </motion.button>
  );
}

export function DangerBtn({
  children, onClick, disabled, loading, small,
}: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
  loading?: boolean; small?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      whileTap={{ scale: 0.97 }}
      className="lms-btn lms-btn-danger"
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: small ? '6px 12px' : '9px 18px',
        borderRadius: R_MD, border: `1px solid ${RED}4D`,
        background: `${RED}0F`,
        color: RED, fontSize: small ? 12 : 13, fontWeight: 600,
        cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
        opacity: (disabled || loading) ? 0.6 : 1,
      }}
    >
      {loading && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} aria-hidden />}
      {children}
    </motion.button>
  );
}

export function GhostBtn({
  children, onClick, disabled, small,
}: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; small?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.97 }}
      className="lms-btn lms-btn-ghost"
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: small ? '5px 10px' : '8px 14px',
        borderRadius: R_MD, border: `1px solid ${BORDER}`,
        background: SURFACE, color: INK_SOFT,
        fontSize: small ? 12 : 13, fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </motion.button>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

export function PageHeader({ title, subtitle, action }: {
  title: string; subtitle?: string; action?: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: 16, marginBottom: 24, flexWrap: 'wrap',
    }}>
      <div>
        <h1 style={{
          margin: 0, fontFamily: FONT_HEADING, fontSize: 24, fontWeight: 700, color: SLATE,
          letterSpacing: '-0.02em', lineHeight: 1.2,
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ margin: '4px 0 0', fontSize: 13, color: MUTED }}>{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

export function EmptyState({ icon: Icon, message, action }: {
  icon: React.ElementType; message: string; action?: React.ReactNode;
}) {
  return (
    <div style={{
      background: BG, border: `1px dashed ${BORDER}`,
      borderRadius: R_LG, padding: '40px 24px', textAlign: 'center',
    }}>
      <Icon size={28} style={{ color: MUTED, margin: '0 auto 10px', display: 'block' }} aria-hidden />
      <p style={{ margin: '0 0 12px', fontSize: 13, color: MUTED }}>{message}</p>
      {/* actions are usually flex buttons, which `textAlign` can't centre */}
      {action ? <div style={{ display: 'flex', justifyContent: 'center' }}>{action}</div> : null}
    </div>
  );
}

// ─── Dhaka datetime helpers (client-side) ─────────────────────────────────────

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

/** Format a UTC epoch (ms) in Dhaka time */
export function fmtDhaka(epochMs: number, opts: Intl.DateTimeFormatOptions = {
  dateStyle: 'medium', timeStyle: 'short',
}): string {
  return new Intl.DateTimeFormat('en-BD', { ...opts, timeZone: 'Asia/Dhaka' })
    .format(new Date(epochMs));
}

/** Convert a datetime-local value (Dhaka) to ISO string for the API */
export function dhakaLocalToISO(value: string): string {
  // value is 'YYYY-MM-DDTHH:mm' representing Dhaka wall-clock time.
  // Parse the components explicitly so the result does not depend on the
  // browser's own timezone, then convert that Dhaka wall-clock to a UTC epoch.
  const [datePart, timePart = '00:00'] = value.split('T');
  const [y, mo, d] = datePart.split('-').map(Number);
  const [h, mi] = timePart.split(':').map(Number);
  const utcMs = Date.UTC(y, mo - 1, d, h, mi) - DHAKA_OFFSET_MS;
  return new Date(utcMs).toISOString();
}

/** Convert a UTC epoch (ms) to a datetime-local string in Dhaka timezone */
export function epochToDhakaLocal(epochMs: number): string {
  const dhakaMs = epochMs + DHAKA_OFFSET_MS;
  const d = new Date(dhakaMs);
  // Format as YYYY-MM-DDTHH:mm
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

export function TabBar({ tabs, active, onChange }: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div style={{
      display: 'flex', gap: 0,
      borderBottom: `1px solid ${BORDER}`,
      marginBottom: 24,
      overflowX: 'auto',
    }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className="lms-tab"
          style={{
            padding: '10px 18px',
            fontSize: 13, fontWeight: active === t.id ? 600 : 400,
            color: active === t.id ? RED : MUTED,
            background: 'transparent', border: 'none', cursor: 'pointer',
            borderBottom: active === t.id ? `2px solid ${RED}` : '2px solid transparent',
            marginBottom: -1, whiteSpace: 'nowrap',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Checkbox ─────────────────────────────────────────────────────────────────

// Was a <div role="switch"> inside a <label> that wrapped no input: not
// focusable, not operable by keyboard, and the label text was dead to clicks
// too. A single <button role="switch"> fixes all three at once — it takes its
// accessible name from the text it contains, so the whole row is one target.
export function Toggle({ checked, onChange, label, ariaLabel }: {
  checked: boolean; onChange: (v: boolean) => void; label: string;
  /**
   * Required when `label` is empty — a bare switch in a dense row has no text
   * to take its name from, and a screen reader would announce only "switch,
   * on" with no clue what it controls.
   */
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ? undefined : ariaLabel}
      onClick={() => onChange(!checked)}
      className="lms-switch"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: 0, border: 'none', background: 'none',
        cursor: 'pointer', textAlign: 'left',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 36, height: 20, borderRadius: R_LG, flexShrink: 0,
          background: checked ? RED : BEIGE,
          // BEIGE alone is only 2.01:1 against the surface, so an "off" switch
          // was barely visible — WCAG 1.4.11 wants 3:1 for a state indicator.
          // An inset ring instead of a border keeps the knob's geometry intact.
          boxShadow: checked ? 'none' : `inset 0 0 0 1.5px ${BORDER_FIELD}`,
          transition: 'background-color 0.18s',
          position: 'relative', display: 'block',
        }}
      >
        <span
          className="lms-switch-knob"
          style={{
            position: 'absolute',
            top: 3, left: 3,
            width: 14, height: 14, borderRadius: '50%',
            background: SURFACE,
            // translateX rather than animating `left`, which is a layout
            // property and forces a reflow on every frame of the slide.
            transform: `translateX(${checked ? 16 : 0}px)`,
            display: 'block',
          }}
        />
      </span>
      <span style={{ fontSize: 13, color: SLATE }}>{label}</span>
    </button>
  );
}

// ─── Check icon btn ───────────────────────────────────────────────────────────

/**
 * Pass `href` for actions that are really navigation (opening a file). Call
 * sites used to wrap this in an `<a>` instead, which nests a button inside a
 * link: invalid markup, two tab stops for one action, and the inner control
 * did nothing. Rendering the anchor here keeps one definition of the tile.
 */
export function IconBtn({
  icon: Icon, onClick, label, danger, disabled, href,
}: {
  icon: React.ElementType; onClick?: () => void; label: string;
  danger?: boolean; disabled?: boolean; href?: string;
}) {
  const shared = {
    className: 'lms-iconbtn',
    title: label,
    'aria-label': label,
    style: {
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: 40, height: 40, borderRadius: R_MD,
      border: `1px solid ${BORDER}`, background: SURFACE,
      color: danger ? RED : INK_SOFT, cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
    } as React.CSSProperties,
  };

  if (href) {
    return (
      <motion.a {...shared} href={href} target="_blank" rel="noopener noreferrer" whileTap={{ scale: 0.92 }}>
        <Icon size={13} aria-hidden />
      </motion.a>
    );
  }

  return (
    <motion.button {...shared} onClick={onClick} disabled={disabled} whileTap={{ scale: 0.92 }}>
      <Icon size={13} aria-hidden />
    </motion.button>
  );
}

// ─── Re-export Check for convenience ──────────────────────────────────────────
export { Check };

'use client';

/**
 * Shared primitives for LMS admin UI.
 * No external UI library — Tailwind + Framer Motion + lucide-react only.
 */

import React from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { X, AlertTriangle, Loader2, Check, ChevronDown } from 'lucide-react';

// ─── Design tokens ────────────────────────────────────────────────────────────

export const RED    = '#D62B38';
export const SLATE  = '#0F172A';
export const BORDER = '#E5E7EB';
export const MUTED  = '#9CA3AF';
export const BG     = '#FAFAFA';

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
    transition: { type: 'spring' as const, stiffness: 380, damping: 32, delay: i * 0.03 },
  }),
};

// ─── Spin keyframe ────────────────────────────────────────────────────────────

export const SPIN_CSS = `@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`;

// ─── Subject badge ────────────────────────────────────────────────────────────

const subjectColors: Record<string, { bg: string; color: string; border: string }> = {
  english:    { bg: 'rgba(59,130,246,0.08)',  color: '#1D4ED8', border: 'rgba(59,130,246,0.2)'  },
  math:       { bg: 'rgba(16,185,129,0.08)', color: '#065F46', border: 'rgba(16,185,129,0.2)'  },
  analytical: { bg: 'rgba(245,158,11,0.10)', color: '#92400E', border: 'rgba(245,158,11,0.25)' },
};

export function SubjectBadge({ subject }: { subject: string }) {
  const s = subjectColors[subject] ?? { bg: '#F3F4F6', color: '#374151', border: BORDER };
  return (
    <span style={{
      display:       'inline-flex',
      alignItems:    'center',
      padding:       '2px 8px',
      borderRadius:  100,
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
  draft:     { bg: '#F3F4F6',                  color: '#6B7280', border: BORDER },
  scheduled: { bg: 'rgba(59,130,246,0.08)',    color: '#1D4ED8', border: 'rgba(59,130,246,0.2)' },
  live:      { bg: 'rgba(16,185,129,0.09)',    color: '#065F46', border: 'rgba(16,185,129,0.25)' },
  completed: { bg: 'rgba(107,114,128,0.08)',   color: '#374151', border: 'rgba(107,114,128,0.2)' },
  cancelled: { bg: 'rgba(239,68,68,0.08)',     color: '#B91C1C', border: 'rgba(239,68,68,0.2)' },
};

export function StatusBadge({ status }: { status: string }) {
  const s = statusColors[status] ?? statusColors.draft;
  return (
    <span style={{
      display:       'inline-flex',
      alignItems:    'center',
      gap:           4,
      padding:       '2px 8px',
      borderRadius:  100,
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
          background: '#10B981', flexShrink: 0,
        }} />
      )}
      {status}
    </span>
  );
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
            zIndex:       9999,
            padding:      '10px 20px',
            borderRadius: 8,
            background:   SLATE,
            color:        '#FFFFFF',
            fontSize:     13,
            fontWeight:   500,
            boxShadow:    '0 4px 20px rgba(0,0,0,0.18)',
            whiteSpace:   'nowrap',
            display:      'flex',
            alignItems:   'center',
            gap:          8,
          }}
        >
          {message}
          {onDismiss && (
            <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', padding: 2 }}>
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
  open, title, message, confirmLabel = 'Confirm', destructive = false, loading = false,
  onConfirm, onCancel,
}: {
  open: boolean; title: string; message: string;
  confirmLabel?: string; destructive?: boolean; loading?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            variants={backdropV} initial="hidden" animate="visible" exit="exit"
            onClick={onCancel}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 300 }}
          />
          <motion.div
            variants={modalV} initial="hidden" animate="visible" exit="exit"
            style={{
              position: 'fixed', top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              zIndex: 301, background: '#FFFFFF', borderRadius: 12,
              padding: '24px 28px', width: 340, maxWidth: '92vw',
              boxShadow: '0 20px 60px rgba(0,0,0,0.14)',
              border: `1px solid ${BORDER}`,
            }}
          >
            <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: destructive ? 'rgba(214,43,56,0.1)' : 'rgba(59,130,246,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AlertTriangle size={17} style={{ color: destructive ? RED : '#3B82F6' }} aria-hidden />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: SLATE, lineHeight: 1.3 }}>{title}</p>
                <p style={{ margin: '5px 0 0', fontSize: 13, color: '#6B7280', lineHeight: 1.45 }}>{message}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <motion.button onClick={onCancel} whileTap={{ scale: 0.97 }} disabled={loading} style={{
                padding: '8px 16px', borderRadius: 7, fontSize: 13, fontWeight: 500,
                border: `1px solid ${BORDER}`, background: '#FFFFFF', color: '#374151',
                cursor: 'pointer', opacity: loading ? 0.5 : 1,
              }}>Cancel</motion.button>
              <motion.button onClick={onConfirm} whileTap={{ scale: 0.97 }} disabled={loading} style={{
                padding: '8px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                border: 'none', background: destructive ? RED : SLATE, color: '#FFFFFF',
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

// ─── Modal wrapper ────────────────────────────────────────────────────────────

export function Modal({
  open, onClose, title, children, width = 560,
}: {
  open: boolean; onClose: () => void; title: string;
  children: React.ReactNode; width?: number;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="modal-backdrop"
            variants={backdropV} initial="hidden" animate="visible" exit="exit"
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.28)', zIndex: 200 }}
          />
          <motion.div
            key="modal-panel"
            variants={modalV} initial="hidden" animate="visible" exit="exit"
            transformTemplate={(_, generated) => `translate(-50%, -50%) ${generated}`}
            style={{
              position: 'fixed', top: '50%', left: '50%',
              zIndex: 201, background: '#FFFFFF', borderRadius: 14,
              width, maxWidth: 'calc(100vw - 32px)', maxHeight: '90vh',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 24px 80px rgba(0,0,0,0.14)',
              border: `1px solid ${BORDER}`,
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: `1px solid ${BORDER}`,
              position: 'sticky', top: 0, background: '#FFFFFF', borderRadius: '14px 14px 0 0',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: SLATE, letterSpacing: '-0.02em' }}>
                {title}
              </span>
              <motion.button
                onClick={onClose} whileTap={{ scale: 0.92 }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: '50%',
                  border: `1px solid ${BORDER}`, background: BG,
                  cursor: 'pointer', color: '#6B7280',
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

// ─── Form field helpers ───────────────────────────────────────────────────────

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280',
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
      style={{
        width: '100%', boxSizing: 'border-box',
        padding: '9px 12px', borderRadius: 7,
        border: `1.5px solid ${BORDER}`, background: BG,
        fontSize: 13, color: SLATE, outline: 'none',
        transition: 'border-color 0.14s',
        ...props.style,
      }}
      onFocus={e => { e.target.style.borderColor = RED; props.onFocus?.(e); }}
      onBlur={e  => { e.target.style.borderColor = BORDER; props.onBlur?.(e); }}
    />
  );
}

export function FieldTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        width: '100%', boxSizing: 'border-box',
        padding: '9px 12px', borderRadius: 7,
        border: `1.5px solid ${BORDER}`, background: BG,
        fontSize: 13, color: SLATE, outline: 'none',
        transition: 'border-color 0.14s', resize: 'vertical', minHeight: 80,
        ...props.style,
      }}
      onFocus={e => { e.target.style.borderColor = RED; props.onFocus?.(e); }}
      onBlur={e  => { e.target.style.borderColor = BORDER; props.onBlur?.(e); }}
    />
  );
}

export function FieldSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        {...props}
        style={{
          width: '100%', boxSizing: 'border-box',
          appearance: 'none', padding: '9px 36px 9px 12px', borderRadius: 7,
          border: `1.5px solid ${BORDER}`, background: BG,
          fontSize: 13, color: SLATE, cursor: 'pointer', outline: 'none',
          transition: 'border-color 0.14s',
          ...props.style,
        }}
        onFocus={e => { e.target.style.borderColor = RED; props.onFocus?.(e); }}
        onBlur={e  => { e.target.style.borderColor = BORDER; props.onBlur?.(e); }}
      />
      <ChevronDown size={13} style={{
        position: 'absolute', right: 10, top: '50%',
        transform: 'translateY(-50%)', color: MUTED, pointerEvents: 'none',
      }} aria-hidden />
    </div>
  );
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
      whileHover={!(disabled || loading) ? { opacity: 0.9 } : {}}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: small ? '6px 12px' : '9px 18px',
        borderRadius: 7, border: 'none', background: SLATE,
        color: '#FFFFFF', fontSize: small ? 12 : 13, fontWeight: 600,
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
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: small ? '6px 12px' : '9px 18px',
        borderRadius: 7, border: `1px solid rgba(214,43,56,0.3)`,
        background: 'rgba(214,43,56,0.06)',
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
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: small ? '5px 10px' : '8px 14px',
        borderRadius: 7, border: `1px solid ${BORDER}`,
        background: '#FFFFFF', color: '#374151',
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
          margin: 0, fontSize: 22, fontWeight: 700, color: SLATE,
          letterSpacing: '-0.04em', lineHeight: 1.2,
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
      borderRadius: 10, padding: '40px 24px', textAlign: 'center',
    }}>
      <Icon size={28} style={{ color: '#D1D5DB', margin: '0 auto 10px', display: 'block' }} aria-hidden />
      <p style={{ margin: '0 0 12px', fontSize: 13, color: MUTED }}>{message}</p>
      {action}
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
  // datetime-local gives 'YYYY-MM-DDTHH:mm' in Dhaka local
  const localMs = new Date(value).getTime(); // JS treats as local, but we need UTC
  // value is Dhaka, so subtract offset to get UTC
  const utcMs = localMs - DHAKA_OFFSET_MS;
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
          style={{
            padding: '10px 18px',
            fontSize: 13, fontWeight: active === t.id ? 600 : 400,
            color: active === t.id ? RED : '#6B7280',
            background: 'transparent', border: 'none', cursor: 'pointer',
            borderBottom: active === t.id ? `2px solid ${RED}` : '2px solid transparent',
            marginBottom: -1, whiteSpace: 'nowrap',
            transition: 'color 0.14s, border-color 0.14s',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Checkbox ─────────────────────────────────────────────────────────────────

export function Toggle({ checked, onChange, label }: {
  checked: boolean; onChange: (v: boolean) => void; label: string;
}) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
    }}>
      <div
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
        style={{
          width: 36, height: 20, borderRadius: 10, flexShrink: 0,
          background: checked ? RED : '#D1D5DB',
          transition: 'background 0.18s',
          position: 'relative', cursor: 'pointer',
        }}
      >
        <div style={{
          position: 'absolute',
          top: 3, left: checked ? 19 : 3,
          width: 14, height: 14, borderRadius: '50%',
          background: '#FFFFFF',
          transition: 'left 0.18s',
        }} />
      </div>
      <span style={{ fontSize: 13, color: SLATE }}>{label}</span>
    </label>
  );
}

// ─── Check icon btn ───────────────────────────────────────────────────────────

export function IconBtn({
  icon: Icon, onClick, label, danger, disabled,
}: {
  icon: React.ElementType; onClick: () => void; label: string;
  danger?: boolean; disabled?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.92 }}
      title={label}
      aria-label={label}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 30, height: 30, borderRadius: 6,
        border: `1px solid ${BORDER}`, background: '#FFFFFF',
        color: danger ? RED : '#6B7280', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Icon size={13} aria-hidden />
    </motion.button>
  );
}

// ─── Re-export Check for convenience ──────────────────────────────────────────
export { Check };

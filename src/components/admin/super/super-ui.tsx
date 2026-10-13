'use client';

/**
 * Super Admin UI kit. Same warm-editorial palette as the rest of /admin; the only
 * visual signature is a deep-ink + gold accent (SUPER_GOLD) used for the eyebrow,
 * page rule and the "SUPER ADMIN" mark. Reuse lms-shared primitives for everything else
 * (buttons, inputs, Modal, ConfirmDialog, Toast, TabBar) — this file only adds what they lack.
 * Server Components: import tokens from '@/components/admin/lms/tokens', not from here.
 */
import React from 'react';
import {
  SLATE, MUTED, BORDER, SURFACE, SURFACE_ALT, RED, OK, OK_BG, WARN, WARN_BG,
  R_LG, R_MD, SHADOW_SM, FONT_HEADING, T_XS, T_SM, T_BASE, T_LG, T_2XL,
  DangerBtn, GhostBtn, FieldInput, Modal, FormActions,
} from '../lms/lms-shared';

export const SUPER_GOLD = '#B8895B';
export const SUPER_GOLD_BG = '#F7EEE3';

/** Page title with a gold eyebrow and rule — every /admin/super page starts with this. */
export function SuperHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: `1px solid ${BORDER}`, position: 'relative' }}>
      <span aria-hidden style={{ position: 'absolute', left: 0, bottom: -1, width: 56, height: 2, background: SUPER_GOLD }} />
      <p style={{ margin: '0 0 6px', fontSize: T_XS, fontWeight: 700, letterSpacing: '0.14em', color: SUPER_GOLD }}>SUPER ADMIN</p>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: FONT_HEADING, fontSize: T_2XL, fontWeight: 700, color: SLATE, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{title}</h1>
          {subtitle && <p style={{ margin: '4px 0 0', fontSize: T_BASE, color: MUTED }}>{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

export function SuperCard({ title, action, children, tone }: { title?: string; action?: React.ReactNode; children: React.ReactNode; tone?: 'danger' }) {
  return (
    <section style={{ background: SURFACE, border: `1px solid ${tone === 'danger' ? RED + '55' : BORDER}`, borderRadius: R_LG, boxShadow: SHADOW_SM, padding: 18, marginBottom: 16 }}>
      {(title || action) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          {title && <h2 style={{ margin: 0, fontSize: T_LG, fontWeight: 600, color: tone === 'danger' ? RED : SLATE }}>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatTile({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: 'ok' | 'warn' | 'bad' }) {
  const color = tone === 'ok' ? OK : tone === 'warn' ? WARN : tone === 'bad' ? RED : SLATE;
  const bg = tone === 'ok' ? OK_BG : tone === 'warn' ? WARN_BG : SURFACE;
  return (
    <div style={{ background: bg, border: `1px solid ${BORDER}`, borderRadius: R_MD, padding: '12px 14px', minWidth: 130 }}>
      <p style={{ margin: 0, fontSize: T_XS, fontWeight: 600, letterSpacing: '0.06em', color: MUTED, textTransform: 'uppercase' }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700, color, fontFamily: FONT_HEADING }}>{value}</p>
      {hint && <p style={{ margin: '2px 0 0', fontSize: T_XS, color: MUTED }}>{hint}</p>}
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>{children}</div>;
}

export function SuperBadge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'gold' }) {
  const map = { neutral: [SURFACE_ALT, SLATE], ok: [OK_BG, OK], warn: [WARN_BG, WARN], bad: ['#F8E6E6', RED], gold: [SUPER_GOLD_BG, '#7A5429'] } as const;
  const [bg, fg] = map[tone];
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, background: bg, color: fg, fontSize: T_XS, fontWeight: 600 }}>{children}</span>;
}

/** Plain responsive table: wrapped in a horizontal scroller so phones never scroll the page. */
export function SuperTable({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: T_SM }}>
        <thead>
          <tr>{head.map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: T_XS, letterSpacing: '0.05em', textTransform: 'uppercase', color: MUTED, borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap' }}>{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export const tdStyle: React.CSSProperties = { padding: '9px 10px', borderBottom: `1px solid ${BORDER}`, verticalAlign: 'top' };

/** Destructive confirmation: the confirm button stays disabled until `phrase` is typed exactly. */
export function TypedConfirm({ open, title, message, phrase, confirmLabel = 'Confirm', loading, onConfirm, onCancel }: {
  open: boolean; title: string; message: string; phrase: string; confirmLabel?: string; loading?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  const [typed, setTyped] = React.useState('');
  React.useEffect(() => { if (!open) setTyped(''); }, [open]);
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <p style={{ margin: '0 0 12px', fontSize: T_BASE, color: SLATE }}>{message}</p>
      <p style={{ margin: '0 0 6px', fontSize: T_SM, color: MUTED }}>Type <strong style={{ color: RED }}>{phrase}</strong> to continue.</p>
      <FieldInput value={typed} onChange={e => setTyped(e.target.value)} autoFocus aria-label="Confirmation phrase" />
      <FormActions>
        <GhostBtn onClick={onCancel} disabled={loading}>Cancel</GhostBtn>
        <DangerBtn onClick={onConfirm} disabled={loading || typed !== phrase}>{loading ? 'Working…' : confirmLabel}</DangerBtn>
      </FormActions>
    </Modal>
  );
}

/** JSON fetch for super pages: throws Error(message) on non-2xx so callers can toast it. */
export async function superApi<T = unknown>(url: string, init?: Omit<RequestInit, 'body'> & { body?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

'use client';

/**
 * Small shared pieces for the Today cockpit: accordion row, stamp chip, button,
 * toast hook, JSON fetch helper and the responsive CSS. Tokens only.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import {
  RED, SLATE, BORDER, MUTED, BG, SURFACE, SURFACE_ALT, OK, OK_BG, WARN, WARN_BG, INFO, INFO_BG,
  R_SM, R_MD, R_LG, FONT_HEADING, T_XS, T_SM, T_BASE, T_MD,
} from '../lms-shared';
import type { RecorderTone } from '@/lib/lms/today-cockpit';

// ─── CSS (hover/focus + phone layout) ─────────────────────────────────────────

export const COCKPIT_CSS = `
.tdy-row-head{display:flex;align-items:center;gap:10px;width:100%;min-height:48px;padding:10px 16px;border:0;background:none;text-align:left;cursor:pointer;color:${SLATE}}
.tdy-row-head:hover{background:${SURFACE_ALT}}
.tdy-row-head:focus-visible,.tdy-focus:focus-visible{outline:2px solid ${RED};outline-offset:-2px}
.tdy-chev{transition:transform .16s ease-out;flex-shrink:0;color:${MUTED}}
.tdy-chev[data-open="true"]{transform:rotate(180deg)}
.tdy-btn:focus-visible,.tdy-stu:focus-visible,.tdy-other:focus-visible{outline:2px solid ${RED};outline-offset:2px}
.tdy-stu{display:flex;align-items:center;gap:10px;width:100%;min-height:48px;padding:6px 12px;border:1px solid ${BORDER};border-radius:${R_MD}px;background:${SURFACE};text-align:left;cursor:pointer;color:${SLATE};transition:background-color .12s,border-color .12s}
.tdy-stu:hover{background:${SURFACE_ALT}}
.tdy-stu[data-s="present"]{border-color:${OK};background:${OK_BG}}
.tdy-stu[data-s="online"]{border-color:${INFO};background:${INFO_BG}}
.tdy-stu[data-s="absent"]{border-color:${RED};border-style:dashed}
.tdy-roster{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}
.tdy-recorder-actions{display:flex;gap:8px;flex-wrap:wrap;margin-left:auto}
.tdy-bottom-bar{display:none}
.tdy-other{display:flex;align-items:center;gap:10px;width:100%;min-height:44px;padding:8px 16px;border:0;border-top:1px solid ${BORDER};background:none;text-align:left;cursor:pointer;color:${SLATE}}
.tdy-other:hover{background:${SURFACE_ALT}}
@media (max-width:640px){
.tdy-roster{grid-template-columns:1fr}
.tdy-recorder-actions{margin-left:0;width:100%}
.tdy-recorder-actions .tdy-btn{flex:1 1 auto}
.tdy-bottom-bar{display:flex;gap:8px;position:fixed;left:0;right:0;bottom:0;padding:10px 16px calc(10px + env(safe-area-inset-bottom));background:${SURFACE};border-top:1px solid ${BORDER}}
.tdy-bottom-bar .tdy-btn{flex:1;justify-content:center;min-height:48px}
.tdy-page{padding-bottom:84px}
.tdy-cols{grid-template-columns:1fr !important}
}
@media (prefers-reduced-motion:reduce){
.tdy-chev,.tdy-stu{transition-duration:.01ms}
}
`;

// ─── Toast hook ───────────────────────────────────────────────────────────────

export function useToast(ms = 3500): [string | null, (m: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const show = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), ms);
  }, [ms]);
  return [msg, show];
}

// ─── fetch helper ─────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function apiJson<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { 'Content-Type': 'application/json', ...rest.headers } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string; code?: string };
    throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status, body.code);
  }
  return res.json() as Promise<T>;
}

// ─── Stamp chip (status is text + icon, never colour alone) ───────────────────

const TONE: Record<RecorderTone, { bg: string; color: string }> = {
  ok:    { bg: OK_BG,       color: OK },
  warn:  { bg: WARN_BG,     color: WARN },
  bad:   { bg: SURFACE,     color: RED },
  info:  { bg: INFO_BG,     color: INFO },
  muted: { bg: SURFACE_ALT, color: MUTED },
};

export function Stamp({ tone, children, title }: { tone: RecorderTone; children: React.ReactNode; title?: string }) {
  const t = TONE[tone];
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
        padding: '2px 9px', borderRadius: R_SM, fontSize: T_XS, fontWeight: 700,
        letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap',
        background: t.bg, color: t.color, border: `1px solid ${t.color}`,
      }}
    >
      {children}
    </span>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────

type BtnVariant = 'primary' | 'ghost' | 'danger';

interface BtnProps {
  children: React.ReactNode;
  variant?: BtnVariant;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  loading?: boolean;
  title?: string;
  ariaLabel?: string;
  type?: 'button' | 'submit';
}

export function Btn({ children, variant = 'ghost', onClick, href, disabled, loading, title, ariaLabel, type = 'button' }: BtnProps) {
  const style: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none',
    padding: '7px 12px', borderRadius: R_MD, fontSize: T_SM, fontWeight: 600,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled || loading ? 0.6 : 1,
    minHeight: 36,
    ...(variant === 'primary'
      ? { background: RED, color: SURFACE, border: '1px solid transparent' }
      : variant === 'danger'
        ? { background: SURFACE, color: RED, border: `1px solid ${RED}` }
        : { background: SURFACE, color: SLATE, border: `1px solid ${BORDER}` }),
  };
  const cls = `tdy-btn lms-btn ${variant === 'primary' ? 'lms-btn-primary' : variant === 'danger' ? 'lms-btn-danger' : 'lms-btn-ghost'}`;
  if (href && !disabled) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls} style={style} title={title} aria-label={ariaLabel}>
        {children}
      </a>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} className={cls} style={style} title={title} aria-label={ariaLabel}>
      {loading && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} aria-hidden />}
      {children}
    </button>
  );
}

// ─── Accordion row ────────────────────────────────────────────────────────────

export function AccordionRow({
  id, label, summary, open, onToggle, attention, children,
}: {
  id: string;
  label: string;
  /** One-line live summary shown in the header (always visible). */
  summary: string;
  open: boolean;
  onToggle: () => void;
  /** Draws the red-pen dot: this row has something unfinished. */
  attention?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ borderTop: `1px solid ${BORDER}` }}>
      <h3 style={{ margin: 0 }}>
        <button
          type="button"
          id={`tdy-h-${id}`}
          className="tdy-row-head"
          aria-expanded={open}
          aria-controls={`tdy-p-${id}`}
          onClick={onToggle}
        >
          <span style={{ fontFamily: FONT_HEADING, fontStyle: 'italic', fontSize: T_MD + 1, fontWeight: 600 }}>{label}</span>
          {attention && (
            <span aria-label="Needs attention" title="Needs attention" style={{ width: 8, height: 8, borderRadius: '50%', background: RED, flexShrink: 0 }} />
          )}
          <span style={{ marginLeft: 'auto', fontSize: T_SM, color: MUTED, textAlign: 'right', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {summary}
          </span>
          <ChevronDown size={16} className="tdy-chev" data-open={open} aria-hidden />
        </button>
      </h3>
      {open && (
        <div id={`tdy-p-${id}`} role="region" aria-labelledby={`tdy-h-${id}`} style={{ padding: '4px 16px 16px', background: BG }}>
          {children}
        </div>
      )}
    </div>
  );
}

export const cardStyle: React.CSSProperties = {
  background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_LG, overflow: 'hidden',
};

export const mutedText: React.CSSProperties = { margin: 0, fontSize: T_SM, color: MUTED };
export const bodyText: React.CSSProperties = { margin: 0, fontSize: T_BASE, color: SLATE };

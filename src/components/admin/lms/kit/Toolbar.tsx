'use client';

import React from 'react';
import { Search } from 'lucide-react';
import {
  RED, MUTED, SLATE, BORDER, BORDER_FIELD, SURFACE, T_SM, T_BASE, R_MD, R_PILL,
} from '../tokens';

/** One-line control strip: sits at the top of a ruled list. */
export function Toolbar({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
      padding: '10px 14px', borderBottom: `1px solid ${BORDER}`,
    }}>
      {children}
    </div>
  );
}

export function ToolbarSpacer() {
  return <span aria-hidden style={{ flex: 1 }} />;
}

export function SearchBox({
  value, onChange, placeholder, label,
}: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{label}</span>
      <Search size={13} aria-hidden style={{ position: 'absolute', left: 10, color: MUTED, pointerEvents: 'none' }} />
      <input
        type="search"
        className="kit-search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          minWidth: 170, height: 36, padding: '0 10px 0 28px', fontSize: T_BASE, color: SLATE,
          border: `1px solid ${BORDER_FIELD}`, borderRadius: R_MD, background: SURFACE,
        }}
      />
    </label>
  );
}

/** Native select with an inline label, used for Sort and Group. */
export function SortMenu<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: T_SM, color: MUTED }}>
      {label}
      <select
        className="kit-sel"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        style={{
          height: 36, padding: '0 8px', fontSize: T_BASE, color: SLATE,
          border: `1px solid ${BORDER_FIELD}`, borderRadius: R_MD, background: SURFACE,
        }}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

/** Toggle chip: state is shown by aria-pressed, a filled border and weight, not colour alone. */
export function FilterChip({
  pressed, onClick, children,
}: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="kit-chip"
      aria-pressed={pressed}
      onClick={onClick}
      style={{
        minHeight: 36, padding: '0 12px', borderRadius: R_PILL, fontSize: T_SM, cursor: 'pointer',
        fontWeight: pressed ? 700 : 400,
        border: `${pressed ? 2 : 1}px solid ${pressed ? RED : BORDER_FIELD}`,
        background: pressed ? `${RED}0D` : SURFACE,
        color: pressed ? RED : MUTED,
      }}
    >
      {children}
    </button>
  );
}

/** Underlined tab strip with an optional count; the active tab carries aria-selected. */
export function CountTabs<T extends string>({
  label, value, tabs, onChange,
}: {
  label: string;
  value: T;
  tabs: readonly { id: T; label: string; count?: number; alert?: boolean }[];
  onChange: (id: T) => void;
}) {
  return (
    <div role="tablist" aria-label={label} style={{ display: 'flex', gap: 0 }}>
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            className="kit-chip"
            onClick={() => onChange(t.id)}
            style={{
              minHeight: 44, padding: '0 14px', fontSize: T_BASE, cursor: 'pointer', whiteSpace: 'nowrap',
              fontWeight: active ? 700 : 400, color: active ? RED : MUTED,
              background: 'transparent', border: 'none',
              borderBottom: `2px solid ${active ? RED : 'transparent'}`,
            }}
          >
            {t.label}
            {t.count != null && (
              <span style={{
                marginLeft: 6, fontSize: 11, fontFamily: 'var(--font-mono), ui-monospace, monospace',
                color: t.alert && t.count > 0 ? RED : MUTED,
              }}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

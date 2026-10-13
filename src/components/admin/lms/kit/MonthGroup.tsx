'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';
import {
  RED, MUTED, SLATE, BORDER, SURFACE_ALT, OK, FONT_HEADING, T_XS, T_SM, T_LG, R_PILL,
} from '../tokens';

export type StripTick = 'done' | 'todo';

/**
 * Collapsible month section. The header is one button (aria-expanded) and
 * carries a dot-strip summary, one tick per item, so a folded month still says
 * how it went: a filled tick is complete, a pale one needs attention.
 */
export function MonthGroup({
  label, open, onToggle, strip, summary, thisMonth, children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  strip?: StripTick[];
  summary?: string;
  thisMonth?: boolean;
  children: React.ReactNode;
}) {
  const panelId = React.useId();
  return (
    <section>
      <button
        type="button"
        className="kit-mo"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 44,
          padding: '8px 14px', border: 0, borderTop: `1px solid ${BORDER}`,
          background: SURFACE_ALT, textAlign: 'left', cursor: 'pointer', color: SLATE,
        }}
      >
        <ChevronRight className="kit-caret" size={14} aria-hidden style={{ color: MUTED, flexShrink: 0 }} />
        <span style={{ fontFamily: FONT_HEADING, fontStyle: 'italic', fontSize: T_LG }}>{label}</span>
        {thisMonth && (
          <span style={{
            fontSize: T_XS, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
            color: RED, border: `1px solid ${RED}`, borderRadius: R_PILL, padding: '0 8px', lineHeight: 1.7,
          }}>
            This month
          </span>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, fontSize: T_SM, color: MUTED }}>
          {strip && strip.length > 0 && (
            <span aria-hidden className="kit-hide-sm" style={{ display: 'inline-flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 220 }}>
              {strip.map((t, i) => (
                <i key={i} style={{
                  display: 'block', width: 6, height: 14, borderRadius: 2,
                  background: t === 'done' ? OK : BORDER,
                }} />
              ))}
            </span>
          )}
          {summary && <span>{summary}</span>}
        </span>
      </button>
      {open && <div id={panelId}>{children}</div>}
    </section>
  );
}

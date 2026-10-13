'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, MessageCircle } from 'lucide-react';
import {
  RED, BORDER, MUTED, SURFACE, SURFACE_ALT, INK_SOFT, WARN, T_XS, T_SM, T_BASE, T_LG, R_LG, FONT_HEADING,
} from '../lms/tokens';
import { Sparkline } from '../lms/Sparkline';
import { buildWhatsAppLink } from '@/lib/students/whatsapp-link';
import { buildCheckInMessage } from '@/lib/students/whatsapp-message';
import { shortReason, sparkSeries } from '@/lib/students/at-risk-pure';
import type { AtRiskStudent } from '@/lib/students/at-risk';

const STORAGE_KEY = 'vh.admin.atRiskOpen';

function initials(name: string): string {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

const CSS = `
.vh-ar-head{transition:background-color .14s}
.vh-ar-head:hover{background:${SURFACE_ALT}}
.vh-ar-head:focus-visible,.vh-ar-msg:focus-visible,.vh-ar-name:focus-visible{outline:2px solid ${RED};outline-offset:2px}
.vh-ar-caret{transition:transform .18s ease-out}
.vh-ar-msg{transition:background-color .14s}
.vh-ar-msg:hover{background:${SURFACE_ALT}}
@media (max-width:560px){.vh-ar-spark{display:none !important}.vh-ar-hint{display:none !important}}
@media (pointer:coarse){.vh-ar-head,.vh-ar-msg{min-height:44px}}
@media (prefers-reduced-motion:reduce){.vh-ar-caret,.vh-ar-head,.vh-ar-msg{transition-duration:.01ms}}
`;

/**
 * Collapsible "At risk" strip for the admin overview. Collapsed by default;
 * the open/closed choice is remembered in this browser. The rule that decides
 * who is on the list lives in at-risk-pure.ts and is unchanged.
 */
export default function AtRiskStrip({ students }: { students: AtRiskStudent[] }) {
  const [open, setOpen] = useState(false);

  // Read after mount so server and first client render agree (collapsed).
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') setOpen(true);
    } catch { /* storage blocked: stay collapsed */ }
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
  };

  if (students.length === 0) return null;
  const panelId = 'admin-at-risk-panel';

  return (
    <section aria-label="At-risk students" style={{ marginBottom: 28, border: `1px solid ${BORDER}`, borderRadius: R_LG, background: SURFACE, overflow: 'hidden' }}>
      <style>{CSS}</style>
      <button
        type="button"
        className="vh-ar-head"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 48, padding: '10px 14px',
          border: 0, background: SURFACE, textAlign: 'left', cursor: 'pointer',
        }}
      >
        <ChevronRight
          size={16}
          aria-hidden
          className="vh-ar-caret"
          style={{ color: MUTED, transform: open ? 'rotate(90deg)' : 'none', flexShrink: 0 }}
        />
        <span style={{ fontFamily: FONT_HEADING, fontSize: T_LG, fontWeight: 600, color: INK_SOFT }}>At risk</span>
        <span style={{ fontSize: T_XS, fontWeight: 700, color: RED, border: `1px solid ${RED}`, borderRadius: 4, padding: '1px 6px', letterSpacing: '0.04em' }}>
          {students.length} {students.length === 1 ? 'student' : 'students'}
        </span>
        <span className="vh-ar-hint" style={{ marginLeft: 'auto', fontSize: T_SM, color: MUTED }}>
          Marks or rank fell for two tests in a row
        </span>
      </button>

      {open && (
        <div id={panelId}>
          {students.map(s => {
            const series = sparkSeries({ scores: s.scores, ranks: s.ranks }, s.reasons);
            const link = buildWhatsAppLink(s.whatsapp, buildCheckInMessage(s.name));
            const sparkLabel = series.kind === 'marks'
              ? `Last test scores: ${s.scores.map(n => `${n}%`).join(', ')}`
              : `Last ranks: ${s.ranks.map(n => `#${n}`).join(', ')}`;
            return (
              <div
                key={s.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', minHeight: 52,
                  borderTop: `1px solid ${BORDER}`, borderLeft: `3px solid ${RED}`,
                }}
              >
                <span aria-hidden style={{
                  width: 28, height: 28, borderRadius: '50%', background: SURFACE_ALT, color: INK_SOFT,
                  fontSize: T_XS, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {initials(s.name)}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Link
                    href={`/admin/students/${s.id}`}
                    className="vh-ar-name"
                    style={{ display: 'block', fontSize: T_BASE, fontWeight: 600, color: INK_SOFT, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {s.name}{s.batch ? ` · ${s.batch}` : ''}
                  </Link>
                  <span style={{ display: 'block', fontSize: T_SM, color: WARN }}>{shortReason(s.reasons)}</span>
                </div>
                <span className="vh-ar-spark">
                  <Sparkline values={series.values} label={sparkLabel} color={RED} />
                </span>
                {link.ok && (
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="vh-ar-msg"
                    aria-label={`Message ${s.name} on WhatsApp`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 32, padding: '0 12px',
                      border: `1px solid ${BORDER}`, borderRadius: 8, color: INK_SOFT, fontSize: T_SM, fontWeight: 600, textDecoration: 'none', flexShrink: 0,
                    }}
                  >
                    <MessageCircle size={13} aria-hidden /> Message
                  </a>
                )}
              </div>
            );
          })}
          <p style={{ margin: 0, padding: '8px 14px', borderTop: `1px solid ${BORDER}`, fontSize: T_XS, color: MUTED }}>
            Line = last three test scores, or ranks when only rank fell. Needs 3 tests to be flagged.
          </p>
        </div>
      )}
    </section>
  );
}

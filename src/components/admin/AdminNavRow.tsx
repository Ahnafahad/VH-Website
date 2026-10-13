'use client';

import Link from 'next/link';
import { BORDER, INK_SOFT, MUTED, RED, SURFACE_ALT, T_BASE, T_XS } from './lms/tokens';
import type { NavBadges, NavItem } from './admin-nav';

export const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

/** Contents-page row: label, dotted leader, live count. Active = bold + 2px maroon tick. */
export default function AdminNavRow({
  item, active, badges, minHeight = 32, onNavigate,
}: {
  item:        NavItem;
  active:      boolean;
  badges:      NavBadges | null;
  minHeight?:  number;
  onNavigate?: () => void;
}) {
  const count = item.badge ? badges?.[item.badge] ?? 0 : 0;
  const stale = item.badge === 'enrolments' ? badges?.enrolmentsStale ?? 0 : 0;
  const hint  = count
    ? `${count} waiting${stale ? `, ${stale} older than 14 days` : ''}`
    : undefined;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      title={hint}
      className="admin-nav-row"
      style={{
        position: 'relative', display: 'flex', alignItems: 'baseline', minHeight,
        padding: '6px 8px 6px 10px', borderRadius: 6, textDecoration: 'none',
        fontSize: T_BASE, fontWeight: active ? 600 : 400, color: active ? INK_SOFT : MUTED,
      }}
    >
      {active && (
        <span aria-hidden style={{ position: 'absolute', left: 0, top: 7, bottom: 7, width: 2, borderRadius: 2, background: RED }} />
      )}
      <span>{item.label}</span>
      <span
        aria-hidden
        style={{ flex: 1, margin: '0 6px', borderBottom: `1px dotted ${active ? RED : BORDER}`, transform: 'translateY(-3px)' }}
      />
      {count > 0 && (
        <span style={{ fontFamily: MONO, fontSize: T_XS, fontWeight: 600, color: RED }}>
          {count}{stale > 0 && <span aria-label={`${stale} older than 14 days`}> !</span>}
        </span>
      )}
    </Link>
  );
}

/** Hover + focus-visible styles shared by every nav surface (render once per surface). */
export const NAV_ROW_CSS = `
.admin-nav-row:hover { background: ${SURFACE_ALT}; }
.admin-nav-row:focus-visible, .admin-nav-btn:focus-visible { outline: 2px solid ${RED}; outline-offset: 1px; }
`;

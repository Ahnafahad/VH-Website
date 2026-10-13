'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { ChevronRight, LogOut, Search } from 'lucide-react';
import AdminProductToggle from './AdminProductToggle';
import AdminJumpPalette from './AdminJumpPalette';
import AdminNavRow, { MONO, NAV_ROW_CSS } from './AdminNavRow';
import { useNavBadges } from './useNavBadges';
import { groupForPath, isActive, navForRole, OVERVIEW_ITEM, overviewFor, type AdminRole } from './admin-nav';
import {
  BEIGE, BG, BORDER, BORDER_FIELD, FONT_HEADING, INK_SOFT, MUTED, OK, R_MD, R_PILL, RED, SLATE, SURFACE, SURFACE_SHELL, T_BASE, T_MD, T_SM, T_XS,
} from './lms/tokens';

interface AdminSidebarProps {
  adminName:  string;
  adminEmail: string;
  role:       AdminRole;
}

const STORAGE_KEY = 'admin-nav-open';
const DEFAULT_OPEN: Record<string, boolean> = { run: true, content: true };

function readOpen(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_OPEN, ...JSON.parse(raw) } : DEFAULT_OPEN;
  } catch { return DEFAULT_OPEN; }
}

function getInitials(name: string): string {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

export default function AdminSidebar({ adminName, adminEmail, role }: AdminSidebarProps) {
  const pathname = usePathname();
  const badges   = useNavBadges();
  const groups   = useMemo(() => navForRole(role), [role]);
  const [open, setOpen]       = useState<Record<string, boolean>>(DEFAULT_OPEN);
  const [palette, setPalette] = useState(false);
  const [isMac, setIsMac]     = useState(false);

  const persist = useCallback((next: Record<string, boolean>) => {
    setOpen(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* storage blocked: folds last for this tab only */ }
  }, []);

  // Restore remembered folds after mount (SSR and first client render must match).
  useEffect(() => { setOpen(readOpen()); setIsMac(/Mac|iPhone|iPad/.test(navigator.platform)); }, []);

  // The group holding the current page opens itself.
  const currentId = groupForPath(groups, pathname)?.id;
  useEffect(() => {
    if (currentId) setOpen(o => (o[currentId] ? o : { ...o, [currentId]: true }));
  }, [currentId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(true); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const live = badges?.live;
  const showOverview = OVERVIEW_ITEM.roles.includes(role);

  return (
    <aside
      className="hidden md:flex flex-col fixed left-0 top-0 h-full w-60 z-40"
      style={{ background: SURFACE_SHELL, borderRight: `1px solid ${BORDER}`, colorScheme: 'light' }}
    >
      <style>{NAV_ROW_CSS}</style>
      <style>{`
        .admin-live-dot { animation: admin-live-pulse 2s ease-in-out infinite; }
        @keyframes admin-live-pulse { 50% { opacity: .35; } }
        @media (prefers-reduced-motion: reduce) { .admin-live-dot { animation: none; } }
      `}</style>

      <div style={{ padding: '16px 14px 10px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Link href="/" aria-label="Beyond the Horizons, back to main site" style={{ display: 'flex', alignSelf: 'flex-start' }}>
          <Image
            src="/bth_compact_square.png" alt="Beyond the Horizons" width={30} height={30}
            style={{ height: 30, width: 30, borderRadius: 8, objectFit: 'cover' }}
          />
        </Link>
        <AdminProductToggle variant="light" />
        {role === 'super_admin' && (
          <span style={{ alignSelf: 'flex-start', padding: '3px 9px', borderRadius: R_PILL, background: SLATE, color: BEIGE, border: `1px solid ${BEIGE}`, fontSize: T_XS, fontWeight: 700, letterSpacing: '0.16em' }}>SUPER ADMIN</span>
        )}
        <button
          onClick={() => setPalette(true)}
          className="admin-nav-btn"
          aria-label="Jump to page"
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 34, padding: '6px 10px',
            border: `1px solid ${BORDER_FIELD}`, borderRadius: R_MD, background: BG, color: MUTED, fontSize: T_SM, cursor: 'pointer',
          }}
        >
          <Search size={14} aria-hidden />
          <span>Jump to page…</span>
          <kbd style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 10, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '0 5px' }}>
            {isMac ? '⌘K' : 'Ctrl K'}
          </kbd>
        </button>
        {live && (
          <Link
            href="/admin/today"
            style={{ display: 'block', border: `1px solid ${BORDER}`, borderRadius: R_MD, padding: '8px 10px', background: BG, textDecoration: 'none' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: T_XS, letterSpacing: '0.08em', textTransform: 'uppercase', color: OK, fontWeight: 600 }}>
              <i aria-hidden className="admin-live-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: OK }} />
              Live now
            </span>
            <span style={{ display: 'block', fontWeight: 600, fontSize: T_BASE, color: INK_SOFT, marginTop: 2 }}>{live.title}</span>
            <span style={{ display: 'block', fontSize: T_SM, color: MUTED }}>
              ends {new Date(live.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
            </span>
          </Link>
        )}
      </div>

      <nav style={{ flex: 1, padding: '0 8px 8px', overflowY: 'auto' }} aria-label="Admin navigation">
        {showOverview && (
          <AdminNavRow item={overviewFor(role)} active={isActive(overviewFor(role), pathname)} badges={badges} />
        )}
        {groups.map(g => {
          const expanded = !!open[g.id];
          return (
            <div key={g.id}>
              <button
                className="admin-nav-btn"
                aria-expanded={expanded}
                aria-controls={`nav-group-${g.id}`}
                onClick={() => persist({ ...open, [g.id]: !expanded })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%', minHeight: 32, padding: '12px 8px 3px 10px',
                  border: 0, background: 'none', cursor: 'pointer', fontFamily: FONT_HEADING, fontStyle: 'italic', fontSize: T_MD, color: MUTED,
                }}
              >
                <ChevronRight size={13} aria-hidden style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform .18s' }} />
                {g.label}
              </button>
              <div id={`nav-group-${g.id}`} hidden={!expanded}>
                {g.items.map(item => (
                  <AdminNavRow key={item.href} item={item} active={isActive(item, pathname)} badges={badges} indent={29} />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div style={{ padding: '12px 14px', borderTop: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div
            aria-hidden
            style={{
              width: 32, height: 32, borderRadius: '50%', background: RED, color: SURFACE, fontSize: T_XS, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, letterSpacing: '0.04em',
            }}
          >
            {getInitials(adminName || 'A')}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: T_SM, fontWeight: 600, color: INK_SOFT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {adminName || 'Admin'}
            </p>
            <p style={{ margin: 0, fontSize: T_XS, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {adminEmail}
            </p>
          </div>
        </div>
        <button
          className="admin-nav-btn"
          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8, minHeight: 36, padding: '8px 10px', background: 'transparent',
            border: `1px solid ${BORDER}`, borderRadius: 7, cursor: 'pointer', color: MUTED, fontSize: T_SM, fontWeight: 500,
          }}
        >
          <LogOut size={13} aria-hidden />
          Sign out
        </button>
      </div>

      <AdminJumpPalette groups={groups} open={palette} onClose={() => setPalette(false)} />
    </aside>
  );
}

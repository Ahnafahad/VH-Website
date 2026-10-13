'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { CalendarCheck, CalendarDays, Ellipsis, FileText, LogOut, Users } from 'lucide-react';
import AdminProductToggle from './AdminProductToggle';
import AdminNavRow, { NAV_ROW_CSS } from './AdminNavRow';
import { useNavBadges } from './useNavBadges';
import { BOTTOM_TABS, isActive, isTabActive, navForRole, OVERVIEW_ITEM, overviewFor, type AdminRole } from './admin-nav';
import { useDialogBehaviour } from './lms/lms-shared';
import {
  BG, BORDER, FONT_HEADING, MUTED, RED, SHADOW_LG, SURFACE, SURFACE_SHELL, T_SM, T_XS, Z_MODAL, Z_MODAL_BACKDROP,
} from './lms/tokens';

interface AdminMobileHeaderProps {
  adminName:  string;
  adminEmail: string;
  role:       AdminRole;
}

const TAB_ICONS = {
  Today: CalendarCheck, Classes: CalendarDays, Students: Users, Content: FileText,
} as const;

const BAR_H = 56;

function getInitials(name: string): string {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

/** Phone chrome: slim top bar, bottom bar (4 everyday areas + More) and the grouped More sheet. */
export default function AdminMobileHeader({ adminName, adminEmail, role }: AdminMobileHeaderProps) {
  const pathname = usePathname();
  const badges   = useNavBadges();
  const groups   = useMemo(() => navForRole(role), [role]);
  const [more, setMore] = useState(false);
  const sheetRef = useDialogBehaviour(more, () => setMore(false));

  const moreActive = more || (!BOTTOM_TABS.some(t => isTabActive(t, groups, pathname)));
  const showOverview = OVERVIEW_ITEM.roles.includes(role);
  // The red dot on More says "something inside needs you" for items not reachable from a tab.
  const moreCount = (badges?.bookings ?? 0) + (badges?.enrolments ?? 0) + (badges?.errors ?? 0);

  return (
    <>
      <style>{NAV_ROW_CSS}</style>
      <style>{`
        #admin-mobile-header, #admin-bottom-bar { display: flex; }
        @media (min-width: 768px) { #admin-mobile-header, #admin-bottom-bar { display: none !important; } }
        #admin-bottom-bar a, #admin-bottom-bar button { text-decoration: none; }
        @media (prefers-reduced-motion: no-preference) { #admin-more-sheet { animation: admin-sheet-in .22s ease-out; } }
        @keyframes admin-sheet-in { from { transform: translateY(24px); opacity: 0; } }
      `}</style>

      <header
        id="admin-mobile-header"
        className="z-40"
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: BAR_H, background: SURFACE_SHELL,
          borderBottom: `1px solid ${BORDER}`, alignItems: 'center', gap: 12, padding: '0 16px', colorScheme: 'light',
        }}
      >
        <Link href="/" aria-label="Beyond the Horizons, back to main site" style={{ display: 'flex', flexShrink: 0 }}>
          <Image
            src="/bth_compact_square.png" alt="Beyond the Horizons" width={28} height={28}
            style={{ height: 28, width: 28, borderRadius: 8, objectFit: 'cover' }}
          />
        </Link>
        <div style={{ flex: 1, maxWidth: 160, marginLeft: 'auto' }}>
          <AdminProductToggle variant="light" />
        </div>
        <div
          style={{
            width: 32, height: 32, borderRadius: '50%', background: RED, color: SURFACE, fontSize: T_XS, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.04em', flexShrink: 0,
          }}
          aria-label={`Signed in as ${adminName}`}
          title={adminName}
        >
          {getInitials(adminName || 'A')}
        </div>
      </header>

      {more && (
        <>
          <div
            onClick={() => setMore(false)} aria-hidden
            style={{ position: 'fixed', inset: 0, background: 'rgba(26,5,7,0.35)', zIndex: Z_MODAL_BACKDROP }}
          />
          <div
            id="admin-more-sheet" ref={sheetRef} role="dialog" aria-modal="true" aria-label="All pages" tabIndex={-1}
            style={{
              position: 'fixed', left: 0, right: 0, bottom: BAR_H + 8, maxHeight: `calc(100dvh - ${BAR_H * 2 + 24}px)`, overflowY: 'auto',
              background: SURFACE, borderTop: `1px solid ${BORDER}`, borderRadius: '18px 18px 0 0', padding: '14px 16px 8px',
              boxShadow: SHADOW_LG, zIndex: Z_MODAL, colorScheme: 'light',
            }}
          >
            {showOverview && (
              <AdminNavRow item={overviewFor(role)} active={isActive(overviewFor(role), pathname)} badges={badges} minHeight={44} onNavigate={() => setMore(false)} />
            )}
            {groups.map(g => (
              <section key={g.id} aria-label={g.label}>
                <h4 style={{ fontFamily: FONT_HEADING, fontStyle: 'italic', fontWeight: 500, color: MUTED, margin: '10px 0 2px 8px', fontSize: 14 }}>
                  {g.label}
                </h4>
                {g.items.map(item => (
                  <AdminNavRow
                    key={item.href} item={item} active={isActive(item, pathname)} badges={badges}
                    minHeight={44} onNavigate={() => setMore(false)}
                  />
                ))}
              </section>
            ))}
            <button
              className="admin-nav-btn"
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, margin: '12px 0 4px', padding: '8px 10px',
                background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 7, cursor: 'pointer', color: MUTED, fontSize: T_SM, fontWeight: 500,
              }}
            >
              <LogOut size={14} aria-hidden />
              Sign out ({adminEmail})
            </button>
          </div>
        </>
      )}

      <nav
        id="admin-bottom-bar" aria-label="Main"
        className="z-40"
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, height: BAR_H, background: SURFACE, borderTop: `1px solid ${BORDER}`,
          paddingBottom: 'env(safe-area-inset-bottom)', boxSizing: 'content-box', colorScheme: 'light',
        }}
      >
        {BOTTOM_TABS.map(tab => {
          const Icon   = TAB_ICONS[tab.label as keyof typeof TAB_ICONS];
          const active = !more && isTabActive(tab, groups, pathname);
          const count  = tab.badge ? badges?.[tab.badge] ?? 0 : 0;
          return (
            <Link
              key={tab.label} href={tab.href} onClick={() => setMore(false)}
              aria-current={active ? 'page' : undefined}
              aria-label={count ? `${tab.label}, ${count} waiting` : tab.label}
              style={tabStyle(active)}
            >
              {active && <span aria-hidden style={tickStyle} />}
              <Icon size={20} aria-hidden />
              {tab.label}
              {count > 0 && <span aria-hidden style={badgeStyle}>{count}</span>}
            </Link>
          );
        })}
        <button
          onClick={() => setMore(m => !m)}
          aria-expanded={more}
          aria-label={moreCount ? `More, ${moreCount} waiting` : 'More'}
          style={{ ...tabStyle(moreActive), border: 0, background: 'none', cursor: 'pointer' }}
        >
          {moreActive && <span aria-hidden style={tickStyle} />}
          <Ellipsis size={20} aria-hidden />
          More
          {moreCount > 0 && <span aria-hidden style={badgeStyle}>{moreCount}</span>}
        </button>
      </nav>
    </>
  );
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 2, minHeight: 52, fontSize: T_XS, fontWeight: active ? 600 : 400, color: active ? RED : MUTED,
  };
}

const tickStyle: React.CSSProperties = { position: 'absolute', top: 0, left: '30%', right: '30%', height: 2, background: RED };

const badgeStyle: React.CSSProperties = {
  position: 'absolute', top: 6, right: '24%', background: RED, color: BG, fontSize: 10, fontWeight: 600,
  borderRadius: 999, minWidth: 16, padding: '0 4px', textAlign: 'center', lineHeight: '16px',
};

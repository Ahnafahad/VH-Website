'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useState } from 'react';
import { AnimatePresence, motion, Variants } from 'framer-motion';
import {
  Menu,
  X,
  LayoutDashboard,
  BookOpen,
  Users,
  Trophy,
  Megaphone,
  LogOut,
  Database,
  BarChart3,
  ClipboardList,
  CalendarDays,
  FileText,
  BookMarked,
  Rss,
  CalendarCheck,
  Settings,
  CalendarClock,
  UserCheck,
  TriangleAlert,
  LineChart,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  href:  string;
  label: string;
  icon:  React.ElementType;
}

interface NavSection {
  label: string | null;
  items: NavItem[];
}

interface AdminMobileHeaderProps {
  adminName:  string;
  adminEmail: string;
  role:       'super_admin' | 'admin' | 'instructor';
}

// ─── Nav sections ─────────────────────────────────────────────────────────────

const INSTRUCTOR_NAV_SECTIONS: NavSection[] = [
  {
    label: null,
    items: [
      { href: '/admin/today', label: 'Today', icon: CalendarCheck },
    ],
  },
  {
    label: 'TEACHING',
    items: [
      { href: '/admin/classes',            label: 'Classes',   icon: CalendarDays  },
      { href: '/admin/materials',          label: 'Materials', icon: FileText      },
      { href: '/admin/homework',           label: 'Homework',  icon: BookMarked    },
      { href: '/admin/bookings',           label: 'Bookings',  icon: CalendarClock },
      { href: '/admin/announcements-feed', label: 'Feed',      icon: Rss           },
    ],
  },
  {
    label: 'MARKS & INSIGHTS',
    items: [
      { href: '/admin/students',  label: 'Progress',      icon: LineChart },
      { href: '/admin/tests',     label: 'Tests & marks', icon: ClipboardList },
      { href: '/admin/analytics', label: 'LMS statistics', icon: BarChart3 },
    ],
  },
  {
    label: 'SETTINGS',
    items: [
      { href: '/admin/settings/google', label: 'Google Calendar', icon: Settings },
    ],
  },
];

const NAV_SECTIONS: NavSection[] = [
  {
    label: null,
    items: [
      { href: '/admin', label: 'Overview', icon: LayoutDashboard },
    ],
  },
  {
    label: 'TEACHING',
    items: [
      { href: '/admin/today',              label: 'Today',    icon: CalendarCheck },
      { href: '/admin/classes',            label: 'Classes',  icon: CalendarDays  },
      { href: '/admin/materials',          label: 'Materials',icon: FileText      },
      { href: '/admin/homework',           label: 'Homework', icon: BookMarked    },
      { href: '/admin/bookings',           label: 'Bookings', icon: CalendarClock },
      { href: '/admin/announcements-feed', label: 'Feed',     icon: Rss           },
    ],
  },
  {
    label: 'MARKS & PRACTICE',
    items: [
      { href: '/admin/tests',       label: 'Tests & marks',icon: ClipboardList },
      { href: '/admin/analytics',   label: 'LMS statistics',icon: BarChart3 },
      { href: '/admin/vocab',       label: 'Vocabulary',  icon: BookOpen      },
      { href: '/admin/words',       label: 'Word Bank',   icon: Database      },
      { href: '/admin/leaderboard', label: 'Leaderboard', icon: Trophy        },
    ],
  },
  {
    label: 'STUDENTS & COMMS',
    items: [
      { href: '/admin/students',      label: 'Progress',      icon: LineChart },
      { href: '/admin/users',         label: 'Users',         icon: Users     },
      { href: '/admin/registrations', label: 'Registrations', icon: UserCheck },
      { href: '/admin/announcements', label: 'Announcements', icon: Megaphone },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { href: '/admin/errors',           label: 'Error Logs',      icon: TriangleAlert },
      { href: '/admin/settings/google',  label: 'Google Calendar', icon: Settings  },
    ],
  },
];

// ─── Motion variants ─────────────────────────────────────────────────────────

const backdropVariants: Variants = {
  hidden:  { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.18 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.16, delay: 0.05 },
  },
};

const drawerVariants: Variants = {
  hidden:  { x: -256 },
  visible: {
    x: 0,
    transition: { type: 'spring' as const, stiffness: 350, damping: 25 },
  },
  exit: {
    x: -256,
    transition: { type: 'spring' as const, stiffness: 400, damping: 30 },
  },
};

const drawerItemVariants: Variants = {
  hidden:  { opacity: 0, x: -8 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      type:      'spring' as const,
      stiffness: 380,
      damping:   28,
      delay:     i * 0.04,
    },
  }),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isActive(href: string, pathname: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(href + '/');
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(p => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminMobileHeader({ adminName, adminEmail, role }: AdminMobileHeaderProps) {
  const pathname        = usePathname();
  const [open, setOpen] = useState(false);

  // ── Instructor shell ───────────────────────────────────────────────────────
  if (role === 'instructor') {
    const bg      = '#1A0507';
    const gold    = '#D4B094';
    const ink     = '#FAF5EF';
    const inkMid  = 'rgba(250,245,239,0.65)';
    const inkDim  = 'rgba(250,245,239,0.35)';
    const goldBg  = 'rgba(212,176,148,0.12)';

    return (
      <>
        <style>{`
          #admin-mobile-header { display: flex; }
          @media (min-width: 768px) { #admin-mobile-header { display: none !important; } }
        `}</style>
        <header
          id="admin-mobile-header"
          style={{
            position:    'fixed',
            top:         0,
            left:        0,
            right:       0,
            height:      56,
            background:  bg,
            borderBottom:`1px solid rgba(212,176,148,0.15)`,
            zIndex:      50,
            alignItems:  'center',
            padding:     '0 16px',
          }}
        >
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setOpen(true)}
            style={{
              background:  'transparent',
              border:      'none',
              cursor:      'pointer',
              padding:     6,
              borderRadius:6,
              display:     'flex',
              alignItems:  'center',
              color:       ink,
            }}
            aria-label="Open navigation menu"
          >
            <Menu size={20} aria-hidden />
          </motion.button>

          <div
            style={{
              position:  'absolute',
              left:      '50%',
              transform: 'translateX(-50%)',
              display:   'flex',
              alignItems:'center',
            }}
          >
            <Image
              src="/lexicore-logo.png"
              alt="LexiCore"
              height={28}
              width={0}
              sizes="100vw"
              style={{ height: 28, width: 'auto', filter: 'brightness(0) invert(1) opacity(0.85)' }}
            />
          </div>

          <div
            style={{
              marginLeft:    'auto',
              width:         32,
              height:        32,
              borderRadius:  '50%',
              background:    gold,
              color:         bg,
              fontSize:      11,
              fontWeight:    700,
              display:       'flex',
              alignItems:    'center',
              justifyContent:'center',
              letterSpacing: '0.04em',
              flexShrink:    0,
            }}
            aria-label={`Signed in as ${adminName}`}
            title={adminName}
          >
            {getInitials(adminName || 'I')}
          </div>
        </header>

        <AnimatePresence>
          {open && (
            <>
              <motion.div
                key="backdrop"
                variants={backdropVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onClick={() => setOpen(false)}
                style={{
                  position:   'fixed',
                  inset:      0,
                  background: 'rgba(0,0,0,0.45)',
                  zIndex:     60,
                }}
                aria-hidden
              />

              <motion.div
                key="drawer"
                variants={drawerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                style={{
                  position:     'fixed',
                  top:          0,
                  left:         0,
                  height:       '100%',
                  width:        256,
                  background:   bg,
                  boxShadow:    '4px 0 24px rgba(0,0,0,0.35)',
                  zIndex:       70,
                  display:      'flex',
                  flexDirection:'column',
                }}
                aria-label="Navigation drawer"
                role="dialog"
                aria-modal
              >
                <div
                  style={{
                    padding:       '16px 16px 14px',
                    borderBottom:  '1px solid rgba(212,176,148,0.15)',
                    display:       'flex',
                    alignItems:    'center',
                    justifyContent:'space-between',
                  }}
                >
                  <Image
                    src="/lexicore-logo.png"
                    alt="LexiCore"
                    height={28}
                    width={0}
                    sizes="100vw"
                    style={{ height: 28, width: 'auto', filter: 'brightness(0) invert(1) opacity(0.85)' }}
                  />
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setOpen(false)}
                    style={{
                      background:   'transparent',
                      border:       'none',
                      cursor:       'pointer',
                      padding:      4,
                      borderRadius: 6,
                      display:      'flex',
                      alignItems:   'center',
                      color:        inkMid,
                    }}
                    aria-label="Close navigation menu"
                  >
                    <X size={18} aria-hidden />
                  </motion.button>
                </div>

                <nav style={{ flex: 1, padding: '8px 8px', overflowY: 'auto' }} aria-label="Instructor navigation">
                  {(() => {
                    let itemIndex = 0;
                    return INSTRUCTOR_NAV_SECTIONS.map((section) => (
                      <div key={section.label ?? '__top__'} style={{ marginBottom: section.label ? 4 : 0 }}>
                        {section.label && (
                          <p
                            style={{
                              margin:        '10px 12px 4px',
                              fontSize:      10,
                              fontWeight:    600,
                              color:         inkDim,
                              letterSpacing: '0.1em',
                              textTransform: 'uppercase',
                              lineHeight:    1,
                            }}
                          >
                            {section.label}
                          </p>
                        )}

                        {section.items.map((item) => {
                          const i      = itemIndex++;
                          const active = isActive(item.href, pathname);
                          const Icon   = item.icon;

                          return (
                            <motion.div
                              key={item.href}
                              custom={i}
                              variants={drawerItemVariants}
                              initial="hidden"
                              animate="visible"
                            >
                              <Link
                                href={item.href}
                                style={{ textDecoration: 'none' }}
                                onClick={() => setOpen(false)}
                              >
                                <div
                                  style={{
                                    position:        'relative',
                                    display:         'flex',
                                    alignItems:      'center',
                                    minHeight:       44,
                                    gap:             10,
                                    padding:         '10px 12px',
                                    border:          '1px solid transparent',
                                    borderColor:     active ? 'rgba(212,176,148,0.28)' : 'transparent',
                                    borderRadius:    9,
                                    backgroundColor: active ? goldBg : 'transparent',
                                    marginBottom:    2,
                                    cursor:          'pointer',
                                    transition:      'background-color 0.12s, border-color 0.12s',
                                  }}
                                >
                                  <Icon
                                    size={16}
                                    style={{ flexShrink: 0, color: active ? gold : inkMid }}
                                    aria-hidden
                                  />
                                  <span
                                    style={{
                                      fontSize:      13,
                                      fontWeight:    active ? 600 : 400,
                                      color:         active ? gold : inkMid,
                                      letterSpacing: '-0.01em',
                                    }}
                                  >
                                    {item.label}
                                  </span>
                                </div>
                              </Link>
                            </motion.div>
                          );
                        })}
                      </div>
                    ));
                  })()}
                </nav>

                <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(212,176,148,0.15)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div
                      style={{
                        width:          32,
                        height:         32,
                        borderRadius:   '50%',
                        background:     gold,
                        color:          bg,
                        fontSize:       11,
                        fontWeight:     700,
                        display:        'flex',
                        alignItems:     'center',
                        justifyContent: 'center',
                        flexShrink:     0,
                        letterSpacing:  '0.04em',
                      }}
                      aria-hidden
                    >
                      {getInitials(adminName || 'I')}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {adminName || 'Instructor'}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, color: inkDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {adminEmail}
                      </p>
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                    style={{
                      width:         '100%',
                      display:       'flex',
                      alignItems:    'center',
                      gap:           8,
                      padding:       '8px 10px',
                      background:    'transparent',
                      border:        '1px solid rgba(250,245,239,0.15)',
                      borderRadius:  7,
                      cursor:        'pointer',
                      color:         inkMid,
                      fontSize:      12,
                      fontWeight:    500,
                      letterSpacing: '-0.01em',
                    }}
                    aria-label="Sign out"
                  >
                    <LogOut size={13} aria-hidden />
                    Sign out
                  </motion.button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </>
    );
  }

  // ── Admin / Super-admin shell (existing white theme) ──────────────────────
  return (
    <>
      {/* ── Fixed top bar — visible below md (768px), hidden at md+ ─────── */}
      {/*
        We use an inline <style> media query rather than relying solely on
        Tailwind `md:hidden` to guarantee the bar disappears at the exact
        breakpoint where the sidebar appears (768 px), regardless of Tailwind
        CSS extraction order or build configuration.
      */}
      <style>{`
        #admin-mobile-header { display: flex; }
        @media (min-width: 768px) { #admin-mobile-header { display: none !important; } }
      `}</style>
      <header
        id="admin-mobile-header"
        style={{
          position:    'fixed',
          top:         0,
          left:        0,
          right:       0,
          height:      56,
          background:  '#FFFFFF',
          borderBottom:'1px solid #E5E7EB',
          zIndex:      50,
          alignItems:  'center',
          padding:     '0 16px',
          colorScheme: 'light',
        }}
      >
        {/* Hamburger */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => setOpen(true)}
          style={{
            background:  'transparent',
            border:      'none',
            cursor:      'pointer',
            padding:     6,
            minWidth:    44,
            minHeight:   44,
            borderRadius:6,
            display:     'flex',
            alignItems:  'center',
            color:       '#374151',
          }}
          aria-label="Open navigation menu"
        >
          <Menu size={20} aria-hidden />
        </motion.button>

        {/* Logo */}
        <div
          style={{
            position:  'absolute',
            left:      '50%',
            transform: 'translateX(-50%)',
            display:   'flex',
            alignItems:'center',
          }}
        >
          <Image
            src="/lexicore-logo.png"
            alt="LexiCore"
            height={28}
            width={0}
            sizes="100vw"
            style={{ height: 28, width: 'auto' }}
          />
        </div>

        {/* Admin initials avatar */}
        <div
          style={{
            marginLeft:    'auto',
            width:         32,
            height:        32,
            borderRadius:  '50%',
            background:    '#D62B38',
            color:         '#FFFFFF',
            fontSize:      11,
            fontWeight:    700,
            display:       'flex',
            alignItems:    'center',
            justifyContent:'center',
            letterSpacing: '0.04em',
            flexShrink:    0,
          }}
          aria-label={`Signed in as ${adminName}`}
          title={adminName}
        >
          {getInitials(adminName || 'A')}
        </div>
      </header>

      {/* ── Slide-in drawer ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setOpen(false)}
              style={{
                position:   'fixed',
                inset:      0,
                background: 'rgba(0,0,0,0.22)',
                zIndex:     60,
              }}
              aria-hidden
            />

            {/* Drawer panel */}
            <motion.div
              key="drawer"
              variants={drawerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{
                position:    'fixed',
                top:         0,
                left:        0,
                height:      '100%',
                width:       256,
                background:  '#FFFFFF',
                boxShadow:   '4px 0 24px rgba(0,0,0,0.10)',
                zIndex:      70,
                display:     'flex',
                flexDirection:'column',
                colorScheme: 'light',
              }}
              aria-label="Navigation drawer"
              role="dialog"
              aria-modal
            >
              {/* Drawer header */}
              <div
                style={{
                  padding:      '16px 16px 14px',
                  borderBottom: '1px solid #E5E7EB',
                  display:      'flex',
                  alignItems:   'center',
                  justifyContent:'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Image
                    src="/lexicore-logo.png"
                    alt="LexiCore"
                    height={28}
                    width={0}
                    sizes="100vw"
                    style={{ height: 28, width: 'auto' }}
                  />
                </div>

                {/* Close button */}
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setOpen(false)}
                  style={{
                    background:   'transparent',
                    border:       'none',
                    cursor:       'pointer',
                    padding:      4,
                    borderRadius: 6,
                    display:      'flex',
                    alignItems:   'center',
                    color:        '#6B7280',
                  }}
                  aria-label="Close navigation menu"
                >
                  <X size={18} aria-hidden />
                </motion.button>
              </div>

              {/* Drawer nav items */}
              <nav
                style={{ flex: 1, padding: '8px 8px', overflowY: 'auto' }}
                aria-label="Admin navigation"
              >
                {(() => {
                  let itemIndex = 0;
                  return NAV_SECTIONS.map((section) => (
                    <div key={section.label ?? '__top__'} style={{ marginBottom: section.label ? 4 : 0 }}>
                      {/* Section header */}
                      {section.label && (
                        <p
                          style={{
                            margin:        '10px 12px 4px',
                            fontSize:      10,
                            fontWeight:    600,
                            color:         '#9CA3AF',
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            lineHeight:    1,
                          }}
                        >
                          {section.label}
                        </p>
                      )}

                      {section.items.map((item) => {
                        const i      = itemIndex++;
                        const active = isActive(item.href, pathname);
                        const Icon   = item.icon;

                        return (
                          <motion.div
                            key={item.href}
                            custom={i}
                            variants={drawerItemVariants}
                            initial="hidden"
                            animate="visible"
                          >
                            <Link
                              href={item.href}
                              style={{ textDecoration: 'none' }}
                              onClick={() => setOpen(false)}
                            >
                              <div
                                style={{
                                  position:        'relative',
                                  display:         'flex',
                                  alignItems:      'center',
                                  minHeight:       44,
                                  gap:             10,
                                  padding:         '10px 12px',
                                  border:          '1px solid transparent',
                                  borderColor:     active ? 'rgba(214,43,56,0.18)' : 'transparent',
                                  borderRadius:    9,
                                  backgroundColor: active ? 'rgba(214,43,56,0.04)' : 'transparent',
                                  marginBottom:    2,
                                  cursor:          'pointer',
                                  transition:      'background-color 0.12s, border-color 0.12s',
                                }}
                              >
                                <Icon
                                  size={16}
                                  style={{
                                    flexShrink: 0,
                                    color:      active ? '#D62B38' : '#6B7280',
                                  }}
                                  aria-hidden
                                />
                                <span
                                  style={{
                                    fontSize:      13,
                                    fontWeight:    active ? 600 : 400,
                                    color:         active ? '#D62B38' : '#374151',
                                    letterSpacing: '-0.01em',
                                  }}
                                >
                                  {item.label}
                                </span>
                              </div>
                            </Link>
                          </motion.div>
                        );
                      })}
                    </div>
                  ));
                })()}
              </nav>

              {/* Drawer footer: admin info + sign out */}
              <div
                style={{
                  padding:   '14px 16px',
                  borderTop: '1px solid #E5E7EB',
                }}
              >
                {/* Admin info row */}
                <div
                  style={{
                    display:      'flex',
                    alignItems:   'center',
                    gap:          10,
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      width:           32,
                      height:          32,
                      borderRadius:    '50%',
                      background:      '#D62B38',
                      color:           '#FFFFFF',
                      fontSize:        11,
                      fontWeight:      700,
                      display:         'flex',
                      alignItems:      'center',
                      justifyContent:  'center',
                      flexShrink:      0,
                      letterSpacing:   '0.04em',
                    }}
                    aria-hidden
                  >
                    {getInitials(adminName || 'A')}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p
                      style={{
                        margin:       0,
                        fontSize:     12,
                        fontWeight:   600,
                        color:        '#111827',
                        overflow:     'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace:   'nowrap',
                      }}
                    >
                      {adminName || 'Admin'}
                    </p>
                    <p
                      style={{
                        margin:       0,
                        fontSize:     11,
                        color:        '#9CA3AF',
                        overflow:     'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace:   'nowrap',
                      }}
                    >
                      {adminEmail}
                    </p>
                  </div>
                </div>

                {/* Sign out */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                  style={{
                    width:         '100%',
                    display:       'flex',
                    alignItems:    'center',
                    gap:           8,
                    padding:       '8px 10px',
                    background:    'transparent',
                    border:        '1px solid #E5E7EB',
                    borderRadius:  7,
                    cursor:        'pointer',
                    color:         '#6B7280',
                    fontSize:      12,
                    fontWeight:    500,
                    letterSpacing: '-0.01em',
                  }}
                  aria-label="Sign out"
                >
                  <LogOut size={13} aria-hidden />
                  Sign out
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

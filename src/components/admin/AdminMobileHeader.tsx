'use client';

import Link from 'next/link';
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
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  href:  string;
  label: string;
  icon:  React.ElementType;
}

interface AdminMobileHeaderProps {
  adminName:  string;
  adminEmail: string;
}

// ─── Nav items (mirrored from AdminSidebar) ───────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { href: '/admin',              label: 'Overview',      icon: LayoutDashboard },
  { href: '/admin/vocab',        label: 'Vocabulary',    icon: BookOpen        },
  { href: '/admin/users',        label: 'Users',         icon: Users           },
  { href: '/admin/leaderboard',  label: 'Leaderboard',   icon: Trophy          },
  { href: '/admin/announcements',label: 'Announcements', icon: Megaphone       },
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

export default function AdminMobileHeader({ adminName, adminEmail }: AdminMobileHeaderProps) {
  const pathname        = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* ── Fixed top bar ─────────────────────────────────────────────────── */}
      <header
        className="md:hidden"
        style={{
          position:    'fixed',
          top:         0,
          left:        0,
          right:       0,
          height:      56,
          background:  '#FFFFFF',
          borderBottom:'1px solid #E5E7EB',
          zIndex:      50,
          display:     'flex',
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
            borderRadius:6,
            display:     'flex',
            alignItems:  'center',
            color:       '#374151',
          }}
          aria-label="Open navigation menu"
        >
          <Menu size={20} aria-hidden />
        </motion.button>

        {/* Title */}
        <span
          style={{
            position:    'absolute',
            left:        '50%',
            transform:   'translateX(-50%)',
            fontSize:    13,
            fontWeight:  600,
            color:       '#111827',
            letterSpacing: '-0.02em',
            whiteSpace:  'nowrap',
          }}
        >
          LexiCore Admin
        </span>

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
                  <span
                    style={{
                      display:        'inline-flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                      background:     '#D62B38',
                      color:          '#FFFFFF',
                      fontSize:       10,
                      fontWeight:     700,
                      letterSpacing:  '0.08em',
                      borderRadius:   5,
                      padding:        '2px 6px',
                      lineHeight:     1,
                    }}
                  >
                    VH
                  </span>
                  <span
                    style={{
                      fontSize:      13,
                      fontWeight:    700,
                      color:         '#0F172A',
                      letterSpacing: '-0.025em',
                    }}
                  >
                    LexiCore Admin
                  </span>
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
                {NAV_ITEMS.map((item, i) => {
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
                            gap:             10,
                            padding:         '10px 12px',
                            borderLeft:      active ? '3px solid #D62B38' : '3px solid transparent',
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
                              fontSize:   13,
                              fontWeight:  active ? 600 : 400,
                              color:       active ? '#D62B38' : '#374151',
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

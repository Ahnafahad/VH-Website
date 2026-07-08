'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { motion, Variants } from 'framer-motion';
import {
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
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  href:  string;
  label: string;
  icon:  React.ElementType;
}

interface NavSection {
  label: string | null; // null = no section header (top-level)
  items: NavItem[];
}

interface AdminSidebarProps {
  adminName:  string;
  adminEmail: string;
}

// ─── Nav sections ─────────────────────────────────────────────────────────────

const NAV_SECTIONS: NavSection[] = [
  {
    label: null,
    items: [
      { href: '/admin', label: 'Overview', icon: LayoutDashboard },
    ],
  },
  {
    label: 'CLASSROOM',
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
    label: 'TESTS & GAMES',
    items: [
      { href: '/admin/tests',       label: 'Tests',       icon: ClipboardList },
      { href: '/admin/vocab',       label: 'Vocabulary',  icon: BookOpen      },
      { href: '/admin/words',       label: 'Word Bank',   icon: Database      },
      { href: '/admin/leaderboard', label: 'Leaderboard', icon: Trophy        },
    ],
  },
  {
    label: 'PEOPLE',
    items: [
      { href: '/admin/users',         label: 'Users',          icon: Users     },
      { href: '/admin/registrations', label: 'Registrations',  icon: UserCheck },
      { href: '/admin/announcements', label: 'Announcements',  icon: Megaphone },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { href: '/admin/analytics',       label: 'Analytics',       icon: BarChart3 },
      { href: '/admin/settings/google', label: 'Google Calendar', icon: Settings  },
    ],
  },
];

// ─── Motion variants ─────────────────────────────────────────────────────────

const sidebarVariants: Variants = {
  hidden:  { opacity: 0, x: -8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 320,
      damping: 28,
      staggerChildren: 0.045,
      delayChildren: 0.05,
    },
  },
};

const navItemVariants: Variants = {
  hidden:  { opacity: 0, x: -6 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring' as const, stiffness: 400, damping: 30 },
  },
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

export default function AdminSidebar({ adminName, adminEmail }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <motion.aside
      variants={sidebarVariants}
      initial="hidden"
      animate="visible"
      className="hidden md:flex flex-col fixed left-0 top-0 h-full w-60 z-40"
      style={{
        background:   '#FAFAFA',
        borderRight:  '1px solid #E5E7EB',
        colorScheme:  'light',
      }}
    >
      {/* ── Logo area ─────────────────────────────────────────────────────── */}
      <div
        style={{
          padding:        '20px 20px 18px',
          borderBottom:   '1px solid #E5E7EB',
          display:        'flex',
          alignItems:     'center',
          gap:            10,
        }}
      >
        {/* LexiCore logo */}
        <Image
          src="/lexicore-logo.png"
          alt="LexiCore"
          height={30}
          width={0}
          sizes="100vw"
          style={{ height: 30, width: 'auto' }}
        />
      </div>

      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <nav
        style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}
        aria-label="Admin navigation"
      >
        {NAV_SECTIONS.map((section, si) => (
          <div key={section.label ?? '__top__'} style={{ marginBottom: section.label ? 6 : 0 }}>
            {/* Section header */}
            {section.label && (
              <p
                style={{
                  margin:        si === 0 ? '8px 12px 4px' : '12px 12px 4px',
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
              const active = isActive(item.href, pathname);
              const Icon   = item.icon;

              return (
                <motion.div
                  key={item.href}
                  variants={navItemVariants}
                >
                  <Link href={item.href} style={{ textDecoration: 'none' }}>
                    <motion.div
                      whileHover={active ? {} : {
                        x: 2,
                        backgroundColor: 'rgba(0,0,0,0.03)',
                        transition: { type: 'spring' as const, stiffness: 400, damping: 30 },
                      }}
                      style={{
                        position:        'relative',
                        display:         'flex',
                        alignItems:      'center',
                        gap:             10,
                        padding:         '9px 12px',
                        cursor:          'pointer',
                        marginBottom:    1,
                        borderLeft:      active ? '3px solid #D62B38' : '3px solid transparent',
                        backgroundColor: active ? 'rgba(214,43,56,0.04)' : 'transparent',
                        transition:      'border-color 0.15s, background-color 0.15s',
                      }}
                    >
                      {/* Animated active bg indicator */}
                      {active && (
                        <motion.span
                          layoutId="admin-nav-active"
                          style={{
                            position:      'absolute',
                            inset:         0,
                            background:    'rgba(214,43,56,0.04)',
                            pointerEvents: 'none',
                            zIndex:        0,
                          }}
                          transition={{ type: 'spring' as const, stiffness: 380, damping: 30 }}
                        />
                      )}

                      <Icon
                        size={16}
                        style={{
                          flexShrink: 0,
                          color:      active ? '#D62B38' : '#6B7280',
                          position:   'relative',
                          zIndex:     1,
                          transition: 'color 0.15s',
                        }}
                        aria-hidden
                      />

                      <span
                        style={{
                          fontSize:      13,
                          fontWeight:    active ? 600 : 400,
                          color:         active ? '#D62B38' : '#6B7280',
                          letterSpacing: '-0.01em',
                          position:      'relative',
                          zIndex:        1,
                          transition:    'color 0.15s, font-weight 0.15s',
                        }}
                      >
                        {item.label}
                      </span>
                    </motion.div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Bottom: admin info + sign out ─────────────────────────────────── */}
      <div
        style={{
          padding:     '14px 16px',
          borderTop:   '1px solid #E5E7EB',
        }}
      >
        {/* Admin name + email */}
        <div
          style={{
            display:      'flex',
            alignItems:   'center',
            gap:          10,
            marginBottom: 10,
          }}
        >
          {/* Initials circle */}
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
                margin:        0,
                fontSize:      12,
                fontWeight:    600,
                color:         '#111827',
                letterSpacing: '-0.01em',
                overflow:      'hidden',
                textOverflow:  'ellipsis',
                whiteSpace:    'nowrap',
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

        {/* Sign out button */}
        <motion.button
          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
          whileHover={{
            backgroundColor: 'rgba(214,43,56,0.06)',
            transition: { type: 'spring' as const, stiffness: 400, damping: 30 },
          }}
          whileTap={{ scale: 0.97 }}
          style={{
            width:          '100%',
            display:        'flex',
            alignItems:     'center',
            gap:            8,
            padding:        '8px 10px',
            background:     'transparent',
            border:         '1px solid #E5E7EB',
            borderRadius:   7,
            cursor:         'pointer',
            color:          '#6B7280',
            fontSize:       12,
            fontWeight:     500,
            letterSpacing:  '-0.01em',
          }}
          aria-label="Sign out"
        >
          <LogOut size={13} aria-hidden />
          Sign out
        </motion.button>
      </div>
    </motion.aside>
  );
}

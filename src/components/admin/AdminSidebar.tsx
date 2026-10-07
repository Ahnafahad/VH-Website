'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import AdminProductToggle from './AdminProductToggle';
import { INSTRUCTOR_NAV_SECTIONS, NAV_SECTIONS } from './admin-nav';
import { motion, Variants } from 'framer-motion';
import {
  BEIGE,
  BG,
  BORDER,
  INK_SOFT,
  MUTED,
  RED,
  SLATE,
  SURFACE,
  SURFACE_SHELL,
  T_BASE,
  T_SM,
  T_XS,
} from './lms/lms-shared';
import {
  LogOut,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminSidebarProps {
  adminName:  string;
  adminEmail: string;
  role:       'super_admin' | 'admin' | 'instructor';
}

// ─── Nav sections ─────────────────────────────────────────────────────────────

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

function isActive(href: string, pathname: string, also: string[] = []): boolean {
  if (href === '/admin') return pathname === '/admin';
  return [href, ...also].some(h => pathname === h || pathname.startsWith(h + '/'));
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

export default function AdminSidebar({ adminName, adminEmail, role }: AdminSidebarProps) {
  const pathname = usePathname();

  // ── Instructor shell (dark themed, classroom-scoped) ──────────────────────
  if (role === 'instructor') {
    const ink     = BG;
    // Alpha variants derived from the shared BG token for dark-shell text and hover states.
    const inkMid  = 'rgba(250,245,239,0.65)';
    const inkDim  = 'rgba(250,245,239,0.35)';
    const gold    = BEIGE;
    const goldBg  = 'rgba(212,176,148,0.12)';
    const hoverBg = 'rgba(250,245,239,0.06)';

    return (
      <motion.aside
        variants={sidebarVariants}
        initial="hidden"
        animate="visible"
        className="hidden md:flex flex-col fixed left-0 top-0 h-full w-60 z-40"
        style={{
          background:  SLATE,
          borderRight: '1px solid rgba(212,176,148,0.15)',
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding:      '20px 20px 18px',
            borderBottom: '1px solid rgba(212,176,148,0.15)',
            display:      'flex',
            flexDirection: 'column',
            gap:          12,
          }}
        >
          <Image
            src="/lexicore-logo.png"
            alt="LexiCore"
            height={30}
            width={0}
            sizes="100vw"
            style={{ height: 30, width: 'auto', filter: 'brightness(0) invert(1) opacity(0.85)' }}
          />
          <AdminProductToggle variant="dark" />
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }} aria-label="Instructor navigation">
          {INSTRUCTOR_NAV_SECTIONS.map((section, si) => (
            <div key={section.label ?? '__top__'} style={{ marginBottom: section.label ? 6 : 0 }}>
              {section.label && (
                <p
                  style={{
                    margin:        si === 0 ? '8px 12px 4px' : '12px 12px 4px',
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
                const active = isActive(item.href, pathname, item.also);
                const Icon   = item.icon;

                return (
                  <motion.div key={item.href} variants={navItemVariants}>
                    <Link href={item.href} style={{ textDecoration: 'none' }}>
                      <motion.div
                        whileHover={active ? {} : {
                          x: 2,
                          backgroundColor: hoverBg,
                          transition: { type: 'spring' as const, stiffness: 400, damping: 30 },
                        }}
                        style={{
                          position:        'relative',
                          display:         'flex',
                          alignItems:      'center',
                          minHeight:       44,
                          gap:             10,
                          padding:         '9px 12px',
                          cursor:          'pointer',
                          marginBottom:    1,
                          border:          '1px solid transparent',
                          borderColor:     active ? 'rgba(212,176,148,0.28)' : 'transparent',
                          borderRadius:    9,
                          backgroundColor: active ? goldBg : 'transparent',
                          transition:      'border-color 0.15s, background-color 0.15s',
                        }}
                      >
                        {active && (
                          <motion.span
                            layoutId="instructor-nav-active"
                            style={{
                              position:      'absolute',
                              inset:         0,
                              background:    goldBg,
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
                            color:      active ? gold : inkMid,
                            position:   'relative',
                            zIndex:     1,
                            transition: 'color 0.15s',
                          }}
                          aria-hidden
                        />

                        <span
                          style={{
                            fontSize:      T_BASE,
                            fontWeight:    active ? 600 : 400,
                            color:         active ? gold : inkMid,
                            letterSpacing: '-0.01em',
                            position:      'relative',
                            zIndex:        1,
                            transition:    'color 0.15s',
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

        {/* Footer */}
        <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(212,176,148,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div
              style={{
                width:          32,
                height:         32,
                borderRadius:   '50%',
                background:     gold,
                color:          SLATE,
                fontSize:       T_XS,
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
              <p
                style={{
                  margin:       0,
                  fontSize:     T_SM,
                  fontWeight:   600,
                  color:        ink,
                  letterSpacing:'-0.01em',
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                }}
              >
                {adminName || 'Instructor'}
              </p>
              <p
                style={{
                  margin:       0,
                  fontSize:     T_XS,
                  color:        inkDim,
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                }}
              >
                {adminEmail}
              </p>
            </div>
          </div>

          <motion.button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            whileHover={{
              backgroundColor: hoverBg,
              transition: { type: 'spring' as const, stiffness: 400, damping: 30 },
            }}
            whileTap={{ scale: 0.97 }}
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
              fontSize:      T_SM,
              fontWeight:    500,
              letterSpacing: '-0.01em',
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

  // ── Admin / Super-admin shell (existing white theme) ──────────────────────
  return (
    <motion.aside
      variants={sidebarVariants}
      initial="hidden"
      animate="visible"
      className="hidden md:flex flex-col fixed left-0 top-0 h-full w-60 z-40"
      style={{
        background:   SURFACE_SHELL,
        borderRight:  `1px solid ${BORDER}`,
        colorScheme:  'light',
      }}
    >
      {/* ── Logo area ─────────────────────────────────────────────────────── */}
      <div
        style={{
          padding:        '20px 20px 18px',
          borderBottom:   `1px solid ${BORDER}`,
          display:        'flex',
          flexDirection:  'column',
          gap:            12,
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
        <AdminProductToggle variant="light" />
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
                  color:         MUTED,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  lineHeight:    1,
                }}
              >
                {section.label}
              </p>
            )}

            {section.items.map((item) => {
              const active = isActive(item.href, pathname, item.also);
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
                        minHeight:       44,
                        gap:             10,
                        padding:         '9px 12px',
                        cursor:          'pointer',
                        marginBottom:    1,
                        border:          '1px solid transparent',
                        borderColor:     active ? 'rgba(118,15,19,0.18)' : 'transparent',
                        borderRadius:    9,
                        backgroundColor: active ? 'rgba(118,15,19,0.04)' : 'transparent',
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
                            background:    'rgba(118,15,19,0.04)',
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
                          color:      active ? RED : MUTED,
                          position:   'relative',
                          zIndex:     1,
                          transition: 'color 0.15s',
                        }}
                        aria-hidden
                      />

                      <span
                        style={{
                          fontSize:      T_BASE,
                          fontWeight:    active ? 600 : 400,
                          color:         active ? RED : MUTED,
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
          borderTop:   `1px solid ${BORDER}`,
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
              background:      RED,
              color:           SURFACE,
              fontSize:        T_XS,
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
                fontSize:      T_SM,
                fontWeight:    600,
                color:         INK_SOFT,
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
                fontSize:     T_XS,
                color:        MUTED,
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
            backgroundColor: 'rgba(118,15,19,0.06)',
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
            border:         `1px solid ${BORDER}`,
            borderRadius:   7,
            cursor:         'pointer',
            color:          MUTED,
            fontSize:       T_SM,
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

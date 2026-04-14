'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, BookOpen, Zap, Trophy, User } from 'lucide-react';
import { useSession } from 'next-auth/react';

const TABS = [
  { id: 'home',        href: '/vocab/home',        icon: Home,     label: 'Home'       },
  { id: 'study',       href: '/vocab/study',       icon: BookOpen, label: 'Study'      },
  { id: 'practice',   href: '/vocab/practice',    icon: Zap,      label: 'Practice'  },
  { id: 'leaderboard',href: '/vocab/leaderboard', icon: Trophy,   label: 'Leaderboard' },
  { id: 'profile',    href: '/vocab/profile',     icon: User,     label: 'Profile'    },
] as const;

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

export default function DesktopSidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { data: session } = useSession();

  const active = TABS.find(t => pathname.startsWith(t.href))?.id ?? 'home';
  const userName  = session?.user?.name  ?? '';
  const userImage = session?.user?.image ?? '';

  return (
    <aside
      className="hidden md:flex"
      style={{
        position:   'fixed',
        top:        0,
        left:       0,
        bottom:     0,
        width:      220,
        zIndex:     40,
        flexDirection: 'column',
        background: 'var(--color-lx-base)',
        borderRight: '1px solid var(--color-lx-border)',
      }}
    >
      {/* Wordmark */}
      <div
        style={{
          padding:      '24px 20px 22px',
          borderBottom: '1px solid var(--color-lx-border)',
          display:      'flex',
          alignItems:   'center',
          gap:          '0.625rem',
        }}
      >
        {/* Logo mark — transparent PNG on dark, crimson glow */}
        <div style={{
          position: 'relative',
          width: 38, height: 38,
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* Radial glow halo */}
          <div style={{
            position: 'absolute',
            inset: '-6px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(230,57,70,0.28) 0%, transparent 68%)',
            pointerEvents: 'none',
          }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/lexicore-logo.png"
            alt="LexiCore"
            style={{
              width: 36, height: 36,
              objectFit: 'contain',
              position: 'relative',
              zIndex: 1,
              filter: 'drop-shadow(0 1px 6px rgba(230,57,70,0.35))',
            }}
          />
        </div>

        {/* Text stack */}
        <div>
          <span
            className="lx-word"
            style={{
              fontFamily:    "'Cormorant Garamond', Georgia, serif",
              fontSize:      '1.5rem',
              fontWeight:    700,
              fontStyle:     'italic',
              color:         'var(--color-lx-text-primary)',
              letterSpacing: '-0.01em',
              display:       'block',
              lineHeight:    1.1,
            }}
          >
            LexiCore
          </span>
          <span
            style={{
              display:       'block',
              fontFamily:    "'Sora', sans-serif",
              fontSize:      '0.6rem',
              fontWeight:    500,
              color:         'var(--color-lx-text-muted)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginTop:     3,
              whiteSpace:    'nowrap',
            }}
          >
            Vocabulary Engine
          </span>
        </div>
      </div>

      {/* Nav items */}
      <nav
        aria-label="Main navigation"
        style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        {TABS.map(tab => {
          const Icon     = tab.icon;
          const isActive = active === tab.id;

          return (
            <motion.button
              key={tab.id}
              onClick={() => router.push(tab.href)}
              whileTap={{ scale: 0.97 }}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
              style={{
                position:      'relative',
                display:       'flex',
                alignItems:    'center',
                gap:           10,
                padding:       '10px 12px',
                borderRadius:  10,
                border:        'none',
                background:    isActive ? 'var(--color-lx-surface)' : 'transparent',
                cursor:        'pointer',
                textAlign:     'left',
                width:         '100%',
                borderLeft:    isActive
                  ? '3px solid var(--color-lx-accent-red)'
                  : '3px solid transparent',
                transition:    'background 0.15s, border-color 0.15s',
              }}
            >
              {/* Active glow */}
              {isActive && (
                <motion.span
                  layoutId="sidebar-active-bg"
                  className="absolute inset-0 rounded-[10px] pointer-events-none"
                  style={{
                    background: 'radial-gradient(ellipse 80% 60% at 10% 50%, rgba(230,57,70,0.10) 0%, transparent 70%)',
                  }}
                  transition={{ type: 'spring' as const, stiffness: 380, damping: 32 }}
                />
              )}

              <Icon
                size={18}
                style={{
                  color:      isActive ? 'var(--color-lx-accent-red)' : 'var(--color-lx-text-muted)',
                  filter:     isActive ? 'drop-shadow(0 0 5px rgba(230,57,70,0.5))' : 'none',
                  transition: 'color 0.2s',
                  flexShrink: 0,
                }}
                strokeWidth={isActive ? 2.2 : 1.7}
              />

              <span
                style={{
                  fontFamily:   "'Sora', sans-serif",
                  fontSize:     '0.8125rem',
                  fontWeight:   isActive ? 600 : 400,
                  color:        isActive ? 'var(--color-lx-text-primary)' : 'var(--color-lx-text-muted)',
                  letterSpacing: '0.02em',
                  transition:   'color 0.2s',
                }}
              >
                {tab.label}
              </span>
            </motion.button>
          );
        })}
      </nav>

      {/* Back to main site */}
      <Link
        href="/"
        style={{
          display:       'flex',
          alignItems:    'center',
          gap:           6,
          padding:       '10px 16px',
          fontFamily:    "'Sora', sans-serif",
          fontSize:      '0.7rem',
          fontWeight:    500,
          letterSpacing: '0.04em',
          color:         'var(--color-lx-text-muted)',
          textDecoration:'none',
          borderTop:     '1px solid var(--color-lx-border)',
          transition:    'color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-lx-text-secondary)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-lx-text-muted)')}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 1L3 6l5 5" />
        </svg>
        VH Website
      </Link>

      {/* User footer */}
      {userName && (
        <div
          style={{
            padding:      '14px 16px',
            borderTop:    '1px solid var(--color-lx-border)',
            display:      'flex',
            alignItems:   'center',
            gap:          10,
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width:        32,
              height:       32,
              borderRadius: '50%',
              overflow:     'hidden',
              flexShrink:   0,
              background:   'var(--color-lx-elevated)',
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              border:       '1px solid var(--color-lx-border)',
            }}
          >
            {userImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={userImage}
                alt={userName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize:   '0.9rem',
                  fontWeight: 700,
                  fontStyle:  'italic',
                  color:      'var(--color-lx-text-secondary)',
                }}
              >
                {initials(userName)}
              </span>
            )}
          </div>

          {/* Name */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <p
              style={{
                fontFamily:   "'Sora', sans-serif",
                fontSize:     '0.75rem',
                fontWeight:   500,
                color:        'var(--color-lx-text-primary)',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
              }}
            >
              {userName}
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}

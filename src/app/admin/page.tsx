/**
 * /admin — Overview dashboard.
 * Server Component under the admin layout (layout.tsx already enforces staff auth).
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import {
  users,
  registrations,
  classSessions,
  sessionRequests,
} from '@/lib/db/schema';
import { eq, and, gte, lt, sql } from 'drizzle-orm';
import { formatDhaka } from '@/lib/lms/time';
import Link from 'next/link';
import {
  Users,
  ClipboardList,
  CalendarDays,
  CalendarCheck,
  BookOpen,
  Database,
  Trophy,
  Megaphone,
  BarChart3,
  FileText,
  BookMarked,
  Rss,
  CalendarClock,
  Settings,
  UserCheck,
} from 'lucide-react';

export const metadata = { title: 'Overview — VH Admin' };
export const dynamic = 'force-dynamic';

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchStats() {
  // Compute Dhaka midnight for "today"
  const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000; // UTC+6
  const nowUtc = new Date();
  const nowDhakaMs = nowUtc.getTime() + DHAKA_OFFSET_MS;
  const dhakaMidnightMs =
    nowDhakaMs -
    (nowDhakaMs % (24 * 60 * 60 * 1000));
  const todayStartUtc = new Date(dhakaMidnightMs - DHAKA_OFFSET_MS);
  const todayEndUtc   = new Date(todayStartUtc.getTime() + 24 * 60 * 60 * 1000);

  const [
    activeStudentsResult,
    todaySessionsResult,
    pendingRequestsResult,
    pendingRegsResult,
  ] = await Promise.all([
    // Active students = users with role 'student' and status 'active'
    db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(eq(users.role, 'student'), eq(users.status, 'active')))
      .get(),

    // Today's class sessions (Dhaka-local midnight → next midnight)
    db
      .select({ count: sql<number>`count(*)` })
      .from(classSessions)
      .where(
        and(
          gte(classSessions.scheduledAt, todayStartUtc),
          lt(classSessions.scheduledAt, todayEndUtc),
        ),
      )
      .get(),

    // Pending session requests
    db
      .select({ count: sql<number>`count(*)` })
      .from(sessionRequests)
      .where(eq(sessionRequests.status, 'pending'))
      .get(),

    // Pending registrations
    db
      .select({ count: sql<number>`count(*)` })
      .from(registrations)
      .where(eq(registrations.status, 'pending'))
      .get(),
  ]);

  return {
    activeStudents:   Number(activeStudentsResult?.count ?? 0),
    todayClasses:     Number(todaySessionsResult?.count  ?? 0),
    pendingRequests:  Number(pendingRequestsResult?.count ?? 0),
    pendingRegs:      Number(pendingRegsResult?.count    ?? 0),
  };
}

// ─── Stat card data ───────────────────────────────────────────────────────────

interface StatCard {
  label:    string;
  value:    number;
  icon:     React.ElementType;
  href:     string;
  color:    string;
  bgColor:  string;
  borderColor: string;
}

// ─── Quick link data ──────────────────────────────────────────────────────────

interface QuickLink {
  label:   string;
  desc:    string;
  href:    string;
  icon:    React.ElementType;
  section: string;
}

const QUICK_LINKS: QuickLink[] = [
  // CLASSROOM
  { label: 'Today',       desc: 'Live console for today\'s class',    href: '/admin/today',              icon: CalendarCheck, section: 'CLASSROOM'       },
  { label: 'Classes',     desc: 'Schedule and manage class sessions',  href: '/admin/classes',            icon: CalendarDays,  section: 'CLASSROOM'       },
  { label: 'Materials',   desc: 'Upload PDFs and share links',         href: '/admin/materials',          icon: FileText,      section: 'CLASSROOM'       },
  { label: 'Homework',    desc: 'Set and review assignments',          href: '/admin/homework',           icon: BookMarked,    section: 'CLASSROOM'       },
  { label: 'Bookings',    desc: '1-on-1 slot management',              href: '/admin/bookings',           icon: CalendarClock, section: 'CLASSROOM'       },
  { label: 'Feed',        desc: 'LMS announcements for students',      href: '/admin/announcements-feed', icon: Rss,           section: 'CLASSROOM'       },
  // TESTS & GAMES
  { label: 'Tests',       desc: 'Mock test questions and results',     href: '/admin/tests',              icon: ClipboardList, section: 'TESTS & GAMES'   },
  { label: 'Vocabulary',  desc: 'LexiCore units, themes, settings',   href: '/admin/vocab',              icon: BookOpen,      section: 'TESTS & GAMES'   },
  { label: 'Word Bank',   desc: 'Browse and edit all vocab words',     href: '/admin/words',              icon: Database,      section: 'TESTS & GAMES'   },
  { label: 'Leaderboard', desc: 'Weekly hall of fame management',      href: '/admin/leaderboard',        icon: Trophy,        section: 'TESTS & GAMES'   },
  // PEOPLE
  { label: 'Users',         desc: 'Manage students and staff',         href: '/admin/users',              icon: Users,         section: 'PEOPLE'          },
  { label: 'Registrations', desc: 'Review sign-up submissions',        href: '/admin/registrations',      icon: UserCheck,     section: 'PEOPLE'          },
  { label: 'Announcements', desc: 'Send email announcements',          href: '/admin/announcements',      icon: Megaphone,     section: 'PEOPLE'          },
  // SYSTEM
  { label: 'Analytics',   desc: 'Platform usage and metrics',          href: '/admin/analytics',          icon: BarChart3,     section: 'SYSTEM'          },
  { label: 'Google Cal',  desc: 'Connect Google Calendar & Meet',      href: '/admin/settings/google',    icon: Settings,      section: 'SYSTEM'          },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default async function AdminOverviewPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');
  const role = session.user.role;
  if (role !== 'admin' && role !== 'super_admin' && role !== 'instructor') {
    redirect('/vocab');
  }

  const stats = await fetchStats();
  const adminName = session.user.name ?? 'Admin';

  const now = new Date();
  const dateLabel = formatDhaka(now, 'date');
  const timeLabel = formatDhaka(now, 'time');

  const statCards: StatCard[] = [
    {
      label:       'Active Students',
      value:       stats.activeStudents,
      icon:        Users,
      href:        '/admin/users',
      color:       '#2563EB',
      bgColor:     '#EFF6FF',
      borderColor: '#BFDBFE',
    },
    {
      label:       "Today's Classes",
      value:       stats.todayClasses,
      icon:        CalendarDays,
      href:        '/admin/today',
      color:       '#059669',
      bgColor:     '#ECFDF5',
      borderColor: '#A7F3D0',
    },
    {
      label:       'Pending Requests',
      value:       stats.pendingRequests,
      icon:        CalendarClock,
      href:        '/admin/bookings',
      color:       '#D97706',
      bgColor:     '#FFFBEB',
      borderColor: '#FDE68A',
    },
    {
      label:       'Pending Registrations',
      value:       stats.pendingRegs,
      icon:        UserCheck,
      href:        '/admin/registrations',
      color:       '#7C3AED',
      bgColor:     '#F5F3FF',
      borderColor: '#DDD6FE',
    },
  ];

  // Group quick links by section
  const sections = ['CLASSROOM', 'TESTS & GAMES', 'PEOPLE', 'SYSTEM'];

  return (
    <div style={{ maxWidth: 900 }}>

      {/* ── Greeting ────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontSize:      22,
            fontWeight:    700,
            color:         '#0F172A',
            letterSpacing: '-0.03em',
            margin:        0,
            lineHeight:    1.2,
          }}
        >
          Good to see you, {adminName.split(' ')[0]}.
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9CA3AF' }}>
          {dateLabel} · {timeLabel} (Asia/Dhaka)
        </p>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(188px, 1fr))',
          gap:                 12,
          marginBottom:        32,
        }}
      >
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              style={{ textDecoration: 'none' }}
            >
              <div
                style={{
                  border:       `1px solid ${card.borderColor}`,
                  borderRadius: 14,
                  padding:      '16px 18px',
                  background:   card.bgColor,
                  display:      'flex',
                  flexDirection:'column',
                  gap:          10,
                  cursor:       'pointer',
                  transition:   'box-shadow 0.15s, transform 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
                  (e.currentTarget as HTMLDivElement).style.transform  = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                  (e.currentTarget as HTMLDivElement).style.transform  = 'translateY(0)';
                }}
              >
                <div
                  style={{
                    width:          36,
                    height:         36,
                    borderRadius:   10,
                    background:     '#FFFFFF',
                    border:         `1px solid ${card.borderColor}`,
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    flexShrink:     0,
                  }}
                >
                  <Icon size={17} style={{ color: card.color }} aria-hidden />
                </div>

                <div>
                  <p
                    style={{
                      margin:     0,
                      fontSize:   26,
                      fontWeight: 700,
                      color:      card.color,
                      lineHeight: 1,
                      letterSpacing: '-0.03em',
                    }}
                  >
                    {card.value}
                  </p>
                  <p
                    style={{
                      margin:     '3px 0 0',
                      fontSize:   11,
                      fontWeight: 500,
                      color:      '#6B7280',
                      lineHeight: 1.3,
                    }}
                  >
                    {card.label}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── Quick links by section ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {sections.map((section) => {
          const links = QUICK_LINKS.filter((l) => l.section === section);
          return (
            <div key={section}>
              {/* Section label */}
              <p
                style={{
                  margin:        '0 0 10px',
                  fontSize:      10,
                  fontWeight:    600,
                  color:         '#9CA3AF',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                {section}
              </p>

              {/* Grid of cards */}
              <div
                style={{
                  display:             'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                  gap:                 8,
                }}
              >
                {links.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      style={{ textDecoration: 'none' }}
                    >
                      <div
                        style={{
                          border:       '1px solid #E5E7EB',
                          borderRadius: 10,
                          padding:      '13px 14px',
                          background:   '#FFFFFF',
                          display:      'flex',
                          alignItems:   'center',
                          gap:          11,
                          cursor:       'pointer',
                          transition:   'border-color 0.12s, background-color 0.12s',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLDivElement).style.borderColor      = '#D1D5DB';
                          (e.currentTarget as HTMLDivElement).style.backgroundColor  = '#F9FAFB';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLDivElement).style.borderColor      = '#E5E7EB';
                          (e.currentTarget as HTMLDivElement).style.backgroundColor  = '#FFFFFF';
                        }}
                      >
                        <div
                          style={{
                            width:          32,
                            height:         32,
                            borderRadius:   8,
                            background:     '#F3F4F6',
                            display:        'flex',
                            alignItems:     'center',
                            justifyContent: 'center',
                            flexShrink:     0,
                          }}
                        >
                          <Icon size={15} style={{ color: '#374151' }} aria-hidden />
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <p
                            style={{
                              margin:       0,
                              fontSize:     13,
                              fontWeight:   600,
                              color:        '#111827',
                              letterSpacing:'-0.01em',
                              whiteSpace:   'nowrap',
                              overflow:     'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {link.label}
                          </p>
                          <p
                            style={{
                              margin:       '1px 0 0',
                              fontSize:     11,
                              color:        '#9CA3AF',
                              lineHeight:   1.3,
                              overflow:     'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace:   'nowrap',
                            }}
                          >
                            {link.desc}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

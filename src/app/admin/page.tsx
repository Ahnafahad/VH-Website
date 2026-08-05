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
import { eq, and, gte, lt, ne, or, isNull, isNotNull, desc, sql } from 'drizzle-orm';
import { formatDhaka } from '@/lib/lms/time';
import ClassCloseoutPrompt, { type CloseoutSession } from '@/components/admin/ClassCloseoutPrompt';
import { getAtRiskStudents, type AtRiskStudent } from '@/lib/students/at-risk';
import { Suspense } from 'react';
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
  AlertTriangle,
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

  // Run all queries independently so a missing LMS table (pre-migration) doesn't
  // crash the whole dashboard — those counts just fall back to 0.
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
      .get()
      .catch(() => null),

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
      .get()
      .catch(() => null),

    // Pending session requests
    db
      .select({ count: sql<number>`count(*)` })
      .from(sessionRequests)
      .where(eq(sessionRequests.status, 'pending'))
      .get()
      .catch(() => null),

    // Pending registrations
    db
      .select({ count: sql<number>`count(*)` })
      .from(registrations)
      .where(eq(registrations.status, 'pending'))
      .get()
      .catch(() => null),
  ]);

  return {
    activeStudents:   Number(activeStudentsResult?.count ?? 0),
    todayClasses:     Number(todaySessionsResult?.count  ?? 0),
    pendingRequests:  Number(pendingRequestsResult?.count ?? 0),
    pendingRegs:      Number(pendingRegsResult?.count    ?? 0),
  };
}

// Teaching instructors ({id, name}) — shared by both closeout + load sections.
async function fetchTeachingUsers() {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.isTeaching, true))
    .all()
    .catch(() => [] as { id: number; name: string }[]);
}

// PAST sessions still missing an instructor and/or a real subject.
async function fetchCloseoutSessions(): Promise<CloseoutSession[]> {
  const now = new Date();
  const rows = await db
    .select({
      id:           classSessions.id,
      title:        classSessions.title,
      subject:      classSessions.subject,
      scheduledAt:  classSessions.scheduledAt,
      instructorId: classSessions.instructorId,
      topic:        classSessions.topic,
      classNumber:  classSessions.classNumber,
    })
    .from(classSessions)
    .where(
      and(
        lt(classSessions.scheduledAt, now),
        ne(classSessions.status, 'cancelled'),
        or(isNull(classSessions.instructorId), eq(classSessions.subject, 'tbd')),
      ),
    )
    .orderBy(desc(classSessions.scheduledAt))
    .limit(20)
    .all()
    .catch(() => [] as (typeof classSessions.$inferSelect)[]);

  return rows.map((r) => ({
    id:           r.id,
    title:        r.title,
    subject:      r.subject,
    scheduledAt:  r.scheduledAt.getTime(),
    instructorId: r.instructorId,
    topic:        r.topic,
    classNumber:  r.classNumber,
  }));
}

// Per-instructor session counts for the current month + previous 2 (Dhaka).
async function fetchInstructorLoad(teachingUsers: { id: number; name: string }[]) {
  const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000; // UTC+6
  const nowDhaka = new Date(Date.now() + DHAKA_OFFSET_MS);
  const y = nowDhaka.getUTCFullYear();
  const m = nowDhaka.getUTCMonth();

  // 3 columns, oldest → current. Each has UTC boundaries for its Dhaka month.
  const months = [2, 1, 0].map((back) => {
    const startUtc = new Date(Date.UTC(y, m - back, 1) - DHAKA_OFFSET_MS);
    const endUtc   = new Date(Date.UTC(y, m - back + 1, 1) - DHAKA_OFFSET_MS);
    return {
      label: formatDhaka(startUtc, { month: 'short', year: 'numeric' }),
      startUtc,
      endUtc,
    };
  });

  const rangeStart = months[0].startUtc;
  const rangeEnd   = months[months.length - 1].endUtc;

  const rows = await db
    .select({
      instructorId:   classSessions.instructorId,
      instructorName: users.name,
      scheduledAt:    classSessions.scheduledAt,
    })
    .from(classSessions)
    .innerJoin(users, eq(classSessions.instructorId, users.id))
    .where(
      and(
        isNotNull(classSessions.instructorId),
        ne(classSessions.status, 'cancelled'),
        gte(classSessions.scheduledAt, rangeStart),
        lt(classSessions.scheduledAt, rangeEnd),
      ),
    )
    .all()
    .catch(() => [] as { instructorId: number | null; instructorName: string; scheduledAt: Date }[]);

  // Instructors = teaching users ∪ anyone who taught in-range.
  const names = new Map<number, string>();
  for (const u of teachingUsers) names.set(u.id, u.name);
  for (const r of rows) if (r.instructorId != null) names.set(r.instructorId, r.instructorName);

  // counts[instructorId][monthIndex]
  const counts = new Map<number, number[]>();
  for (const id of names.keys()) counts.set(id, months.map(() => 0));
  for (const r of rows) {
    if (r.instructorId == null) continue;
    const t = r.scheduledAt.getTime();
    const idx = months.findIndex((mo) => t >= mo.startUtc.getTime() && t < mo.endUtc.getTime());
    if (idx >= 0) counts.get(r.instructorId)![idx] += 1;
  }

  const instructors = [...names.entries()]
    .map(([id, name]) => ({ id, name, counts: counts.get(id)! }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { monthLabels: months.map((mo) => mo.label), instructors };
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

const PRIMARY_ACTIONS = [
  { label: "Run today's class", href: '/admin/today', icon: CalendarCheck, primary: true },
  { label: 'Schedule a class', href: '/admin/classes', icon: CalendarDays },
  { label: 'Share a PDF', href: '/admin/materials', icon: FileText },
  { label: 'Check marks', href: '/admin/tests', icon: ClipboardList },
  { label: 'LMS statistics', href: '/admin/analytics', icon: BarChart3 },
];

// ─── Component ────────────────────────────────────────────────────────────────

// Rendered inside <Suspense> so the rest of the admin home paints immediately.
// getAtRiskStudents() fans out per-student metric reads and takes seconds; a failure
// resolves to an empty list rather than taking the page down.
async function AtRiskSection() {
  const atRiskStudents = await getAtRiskStudents().catch(() => [] as AtRiskStudent[]);
  if (!atRiskStudents.length) return null;

  return (
    <section aria-labelledby="admin-at-risk-heading" style={{ marginBottom: 28 }}>
      <h2
        id="admin-at-risk-heading"
        style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 10px', fontSize: 14, color: '#B91C1C' }}
      >
        <AlertTriangle size={15} aria-hidden /> At-risk students ({atRiskStudents.length})
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {atRiskStudents.map((s) => (
          <Link
            key={s.id}
            href={`/admin/students/${s.id}`}
            style={{
              display: 'block', textDecoration: 'none',
              border: '1px solid #FECACA', borderRadius: 10,
              background: '#FEF2F2', padding: '10px 14px',
            }}
          >
            <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
              {s.name}{s.batch ? ` · ${s.batch}` : ''}
            </p>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#7F1D1D' }}>
              {s.reasons.map(r => <li key={r.code}>{r.message}</li>)}
            </ul>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default async function AdminOverviewPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');
  const role = session.user.role;
  if (role !== 'admin' && role !== 'super_admin' && role !== 'instructor') {
    redirect('/vocab');
  }

  const teachingUsers = await fetchTeachingUsers();
  const [stats, closeoutSessions, instructorLoad] = await Promise.all([
    fetchStats(),
    fetchCloseoutSessions(),
    fetchInstructorLoad(teachingUsers),
  ]);
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

      {/* Hover styles — this is a Server Component, so interactivity must be pure
          CSS (event handlers can't be passed to client props from the server). */}
      <style>{`
        .vh-stat-card { transition: box-shadow 0.15s, transform 0.15s; }
        .vh-stat-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); transform: translateY(-1px); }
        .vh-primary-action { transition: transform 0.15s, background-color 0.15s, border-color 0.15s; }
        .vh-primary-action:hover { transform: translateY(-1px); border-color: #C9A88E !important; }
        .vh-quick-card { transition: background-color 0.12s; }
        .vh-quick-card:hover { background-color: #F9FAFB; }
      `}</style>

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

      {/* ── Needs attention (post-class close-out) ──────────────────────────── */}
      <ClassCloseoutPrompt sessions={closeoutSessions} teachingUsers={teachingUsers} />

      {/* ── At-risk students ──────────────────────────────────────────────────── */}
      {/* Streamed separately: the scan reads per-student metrics and takes seconds.
          Inside the page's Promise.all it delayed the whole admin home by that much. */}
      <Suspense fallback={null}>
        <AtRiskSection />
      </Suspense>

      <section aria-labelledby="admin-start-heading" style={{ marginBottom: 28 }}>
        <h2 id="admin-start-heading" style={{ margin: '0 0 10px', fontSize: 14, color: '#111827' }}>What do you need to do?</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PRIMARY_ACTIONS.map(action => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="vh-primary-action"
                style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, border: action.primary ? '1px solid #760F13' : '1px solid #E1D4CB', background: action.primary ? '#760F13' : '#FFFFFF', color: action.primary ? '#FFFFFF' : '#5A0B0F', textDecoration: 'none', fontSize: 13, fontWeight: 650 }}
              >
                <Icon size={16} aria-hidden />
                {action.label}
              </Link>
            );
          })}
        </div>
      </section>

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
                className="vh-stat-card"
                style={{
                  border:       `1px solid ${card.borderColor}`,
                  borderRadius: 14,
                  padding:      '16px 18px',
                  background:   card.bgColor,
                  display:      'flex',
                  flexDirection:'column',
                  gap:          10,
                  cursor:       'pointer',
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

      {/* ── Instructor load ─────────────────────────────────────────────────── */}
      {instructorLoad.instructors.length > 0 && (
        <div style={{ marginBottom: 32 }}>
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
            Instructor load
          </p>
          <div style={{ border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#6B7280' }}>
                    Instructor
                  </th>
                  {instructorLoad.monthLabels.map((label) => (
                    <th key={label} style={{ textAlign: 'right', padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#6B7280' }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {instructorLoad.instructors.map((ins, i) => (
                  <tr key={ins.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #F3F4F6' }}>
                    <td style={{ padding: '10px 14px', color: '#111827', fontWeight: 500 }}>{ins.name}</td>
                    {ins.counts.map((c, j) => (
                      <td key={j} style={{ padding: '10px 14px', textAlign: 'right', color: c === 0 ? '#D1D5DB' : '#111827', fontVariantNumeric: 'tabular-nums' }}>
                        {c === 0 ? '—' : c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap:                 0,
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
                        className="vh-quick-card"
                        style={{
                          borderBottom: '1px solid #E5E7EB',
                          padding:      '12px 4px',
                          background:   'transparent',
                          display:      'flex',
                          alignItems:   'center',
                          gap:          11,
                          cursor:       'pointer',
                        }}
                      >
                        <div
                          style={{
                            width:          32,
                            height:         32,
                            borderRadius:   8,
                            background:     'transparent',
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

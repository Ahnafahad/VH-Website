import type React from 'react';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Trophy,
  Megaphone,
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
  Drama,
  Route,
  NotebookPen,
  Printer,
  Scale,
  Crown,
  ShieldCheck,
  UserCog,
  GraduationCap,
  FlaskConical,
  ToggleRight,
  Server,
  ScanSearch,
  Terminal,
  ScrollText,
  KeyRound,
  Hourglass,
  Radio,
  Wallet,
  LayoutGrid,
} from 'lucide-react';

// Single source of truth for the admin navigation: the desktop sidebar and the mobile menu both
// render these lists, so an item can never exist on one and be missing from the other.

export interface NavItem {
  href:  string;
  label: string;
  icon:  React.ComponentType<import('lucide-react').LucideProps>;
  also?: string[]; // extra route prefixes that keep this item highlighted
}

export interface NavSection {
  label: string | null; // null = no section header (top-level)
  items: NavItem[];
}

export const INSTRUCTOR_NAV_SECTIONS: NavSection[] = [
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
      { href: '/admin/printdesk',          label: 'PrintDesk', icon: Printer       },
      { href: '/admin/bookings',           label: 'Bookings',  icon: CalendarClock },
      { href: '/admin/announcements-feed', label: 'Feed',      icon: Rss           },
    ],
  },
  {
    label: 'MARKS & INSIGHTS',
    items: [
      { href: '/admin/students',      label: 'Progress',      icon: LineChart },
      { href: '/admin/tests',         label: 'Tests & marks', icon: ClipboardList },
      { href: '/admin/essays',        label: 'Essays',        icon: NotebookPen },
      { href: '/admin/last-word',     label: 'Last Word',     icon: Scale },
      { href: '/admin/analytics',     label: 'LMS statistics', icon: BarChart3 },
      { href: '/admin/practice', label: 'Practice & Diagnosis', icon: Route, also: ['/admin/marathon', '/admin/sprint', '/admin/redline', '/admin/diagnosis-fbs'] },
    ],
  },
  {
    label: 'SETTINGS',
    items: [
      { href: '/admin/settings/google', label: 'Google Calendar', icon: Settings },
    ],
  },
];

export const NAV_SECTIONS: NavSection[] = [
  {
    label: null,
    items: [
      { href: '/admin', label: 'Overview', icon: LayoutDashboard },
      { href: '/admin/operational', label: 'Operational Admin', icon: ClipboardList },
    ],
  },
  {
    label: 'TEACHING',
    items: [
      { href: '/admin/today',              label: 'Today',    icon: CalendarCheck },
      { href: '/admin/classes',            label: 'Classes',  icon: CalendarDays  },
      { href: '/admin/materials',          label: 'Materials',icon: FileText      },
      { href: '/admin/homework',           label: 'Homework', icon: BookMarked    },
      { href: '/admin/printdesk',          label: 'PrintDesk',icon: Printer       },
      { href: '/admin/bookings',           label: 'Bookings', icon: CalendarClock },
      { href: '/admin/announcements-feed', label: 'Feed',     icon: Rss           },
    ],
  },
  {
    label: 'MARKS & PRACTICE',
    items: [
      { href: '/admin/tests',       label: 'Tests & marks',icon: ClipboardList },
      { href: '/admin/essays',      label: 'Essays',      icon: NotebookPen   },
      { href: '/admin/analytics',   label: 'LMS statistics',icon: BarChart3 },
      { href: '/admin/vocab',       label: 'Vocabulary',  icon: BookOpen      },
      { href: '/admin/words',       label: 'Word Bank',   icon: Database      },
      { href: '/admin/last-word',   label: 'Last Word',   icon: Scale         },
      { href: '/admin/leaderboard', label: 'Leaderboard', icon: Trophy        },
      { href: '/admin/practice', label: 'Practice & Diagnosis', icon: Route, also: ['/admin/marathon', '/admin/sprint', '/admin/redline', '/admin/diagnosis-fbs'] },
    ],
  },
  {
    label: 'STUDENTS & COMMS',
    items: [
      { href: '/admin/students',      label: 'Progress',       icon: LineChart },
      { href: '/admin/users',         label: 'Users',          icon: Users     },
      { href: '/admin/registrations', label: 'Registrations',  icon: UserCheck },
      { href: '/admin/announcements', label: 'Announcements',  icon: Megaphone },
      { href: '/admin/avatars',       label: 'Avatars',        icon: Drama    },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { href: '/admin/errors',           label: 'Error Logs',     icon: TriangleAlert },
      { href: '/admin/settings/google',  label: 'Google Calendar', icon: Settings  },
    ],
  },
];

// Super-admin-only section, prepended for role === 'super_admin'. Every page behind these links
// is gated server-side by requireSuperAdminPage()/requireSuperAdmin() — hiding the nav is cosmetic.
export const SUPER_NAV_SECTIONS: NavSection[] = [
  {
    label: 'SUPER ADMIN',
    items: [
      { href: '/admin/super',            label: 'Command Center',   icon: Crown },
      { href: '/admin/super/staff',      label: 'Staff manager',    icon: UserCog },
      { href: '/admin/super/students',   label: 'Student control',  icon: GraduationCap },
      { href: '/admin/super/tests',      label: 'Tests & grading',  icon: FlaskConical },
      { href: '/admin/super/switches',   label: 'Feature switches', icon: ToggleRight },
      { href: '/admin/super/broadcast',  label: 'Comms',            icon: Radio },
      { href: '/admin/super/finance',    label: 'Finance',          icon: Wallet },
      { href: '/admin/super/ops',        label: 'Operations',       icon: Server },
      { href: '/admin/super/integrity',  label: 'Data integrity',   icon: ScanSearch },
      { href: '/admin/super/sql',        label: 'SQL console',      icon: Terminal },
      { href: '/admin/super/audit',      label: 'Audit log',        icon: ScrollText },
      { href: '/admin/super/security',   label: 'Security',         icon: ShieldCheck },
      { href: '/admin/super/permissions',label: 'Permissions',      icon: KeyRound },
      { href: '/admin/super/approvals',  label: 'Approvals & danger', icon: Hourglass },
    ],
  },
];

/** Sections to render for a staff role. Super admins get their own section first, and the
 *  classic Overview link carries ?classic=1 so /admin stops redirecting them to the Command Center. */
export function navSectionsFor(role: 'super_admin' | 'admin' | 'instructor'): NavSection[] {
  if (role === 'instructor') return INSTRUCTOR_NAV_SECTIONS;
  if (role !== 'super_admin') return NAV_SECTIONS;
  const classic = NAV_SECTIONS.map(sec => ({
    ...sec,
    items: sec.items.map(i => (i.href === '/admin' ? { ...i, href: '/admin?classic=1', label: 'Classic overview', icon: LayoutGrid } : i)),
  }));
  return [...SUPER_NAV_SECTIONS, ...classic];
}

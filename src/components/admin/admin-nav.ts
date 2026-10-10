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

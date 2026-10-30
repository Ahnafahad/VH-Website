// Single role-aware nav config. The desktop sidebar, the phone bottom bar and the More sheet all
// render from this one list, so an item can never exist on one surface and be missing from another.
// Pure data + pure functions only (no React), so the role/active/filter logic is unit-testable.

export type AdminRole = 'super_admin' | 'admin' | 'instructor';

/** Keys of the live-count payload from /api/admin/nav-badges. */
export type BadgeKey = 'homework' | 'enrolments' | 'essays' | 'errors' | 'bookings';

export interface NavItem {
  href:   string;
  label:  string;
  roles:  readonly AdminRole[];
  also?:  readonly string[]; // extra route prefixes that keep this item highlighted
  badge?: BadgeKey;          // count slot; red only when > 0 (every badge here means "someone must act")
}

export interface NavGroup {
  id:    'super' | 'run' | 'content' | 'students' | 'insights' | 'admin';
  label: string;
  items: readonly NavItem[];
}

const ALL: readonly AdminRole[] = ['super_admin', 'admin', 'instructor'];
const ADMINS: readonly AdminRole[] = ['super_admin', 'admin'];
const SUPER: readonly AdminRole[] = ['super_admin'];

/** Pinned above the groups, admins only. */
export const OVERVIEW_ITEM: NavItem = { href: '/admin', label: 'Overview', roles: ADMINS };

/** Super-admin area. Every page behind these links is gated server-side by requireSuperAdminPage() /
 *  requireSuperAdmin(); hiding the links here is cosmetic. Rendered first, only for super_admin. */
export const SUPER_GROUP: NavGroup = {
  id: 'super', label: 'Super admin',
  items: [
    { href: '/admin/super',             label: 'Command Center',     roles: SUPER },
    { href: '/admin/super/staff',       label: 'Staff manager',      roles: SUPER },
    { href: '/admin/super/students',    label: 'Student control',    roles: SUPER },
    { href: '/admin/super/tests',       label: 'Tests & grading',    roles: SUPER },
    { href: '/admin/super/switches',    label: 'Feature switches',   roles: SUPER },
    { href: '/admin/super/broadcast',   label: 'Comms',              roles: SUPER },
    { href: '/admin/super/finance',     label: 'Finance',            roles: SUPER },
    { href: '/admin/super/ops',         label: 'Operations',         roles: SUPER },
    { href: '/admin/super/integrity',   label: 'Data integrity',     roles: SUPER },
    { href: '/admin/super/sql',         label: 'SQL console',        roles: SUPER },
    { href: '/admin/super/audit',       label: 'Audit log',          roles: SUPER },
    { href: '/admin/super/security',    label: 'Security',           roles: SUPER },
    { href: '/admin/super/permissions', label: 'Permissions',        roles: SUPER },
    { href: '/admin/super/approvals',   label: 'Approvals & danger', roles: SUPER },
  ],
};

/** /admin redirects super admins to the Command Center, so their Overview link carries ?classic=1. */
export function overviewFor(role: AdminRole): NavItem {
  return role === 'super_admin'
    ? { ...OVERVIEW_ITEM, href: '/admin?classic=1', label: 'Classic overview' }
    : OVERVIEW_ITEM;
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: 'run', label: 'Run',
    items: [
      { href: '/admin/today',    label: 'Today',    roles: ALL },
      { href: '/admin/classes',  label: 'Classes',  roles: ALL },
      { href: '/admin/bookings', label: 'Bookings', roles: ALL, badge: 'bookings' },
    ],
  },
  {
    id: 'content', label: 'Content',
    items: [
      { href: '/admin/materials',          label: 'Materials',     roles: ALL },
      { href: '/admin/homework',           label: 'Homework',      roles: ALL, badge: 'homework' },
      { href: '/admin/tests',              label: 'Tests & marks', roles: ALL },
      { href: '/admin/mocks',              label: 'Mocks',         roles: ALL },
      { href: '/admin/essays',             label: 'Essays',        roles: ALL, badge: 'essays' },
      { href: '/admin/printdesk',          label: 'PrintDesk',     roles: ALL },
      { href: '/admin/announcements-feed', label: 'Feed',          roles: ALL },
      { href: '/admin/words',              label: 'Word Bank',     roles: ADMINS },
    ],
  },
  {
    id: 'students', label: 'Students',
    items: [
      { href: '/admin/students',      label: 'Progress',    roles: ALL },
      { href: '/admin/users',         label: 'Users',       roles: ADMINS },
      // Label is "Enrolments"; the route stays /admin/registrations until the enrol agent moves it.
      { href: '/admin/registrations', label: 'Enrolments',  roles: ADMINS, badge: 'enrolments' },
      { href: '/admin/leaderboard',   label: 'Leaderboard', roles: ADMINS },
      { href: '/admin/avatars',       label: 'Avatars',     roles: ADMINS },
    ],
  },
  {
    id: 'insights', label: 'Insights',
    items: [
      // Games is a tab inside Statistics, not a nav entry.
      { href: '/admin/analytics', label: 'Statistics', roles: ALL },
      {
        href: '/admin/practice', label: 'Practice & diagnosis', roles: ALL,
        also: ['/admin/marathon', '/admin/sprint', '/admin/redline', '/admin/diagnosis-fbs'],
      },
    ],
  },
  {
    id: 'admin', label: 'Admin',
    items: [
      { href: '/admin/operational',     label: 'Operational',   roles: ADMINS },
      { href: '/admin/announcements',   label: 'Announcements', roles: ADMINS },
      { href: '/admin/errors',          label: 'Errors',        roles: ADMINS, badge: 'errors' },
      { href: '/admin/settings/google', label: 'Settings',      roles: ALL },
    ],
  },
];

/** Groups with only the items this role may see; empty groups are dropped. */
export function navForRole(role: AdminRole, groups: readonly NavGroup[] = NAV_GROUPS): NavGroup[] {
  const all = role === 'super_admin' && groups === NAV_GROUPS ? [SUPER_GROUP, ...groups] : groups;
  return all
    .map(g => ({ ...g, items: g.items.filter(i => i.roles.includes(role)) }))
    .filter(g => g.items.length > 0);
}

export function isActive(item: Pick<NavItem, 'href' | 'also'>, pathname: string): boolean {
  const href = item.href.split('?')[0];
  if (href === '/admin' || href === '/admin/super') return pathname === href;
  return [href, ...(item.also ?? [])].some(h => pathname === h || pathname.startsWith(h + '/'));
}

/** The group holding the current page (auto-opened in the sidebar), or undefined. */
export function groupForPath(groups: readonly NavGroup[], pathname: string): NavGroup | undefined {
  return groups.find(g => g.items.some(i => isActive(i, pathname)));
}

/** Case-insensitive substring match on label; empty query returns nothing. */
export function filterItems(groups: readonly NavGroup[], query: string): NavItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return groups.flatMap(g => g.items).filter(i => i.label.toLowerCase().includes(q));
}

// Phone bottom bar: four everyday areas. "Students" and "Content" light up for any page in
// their group (match = group id); Today and Classes match their own route.
export interface BottomTab {
  label:  string;
  href:   string;
  group?: NavGroup['id'];
  badge?: BadgeKey;
}

export const BOTTOM_TABS: readonly BottomTab[] = [
  { label: 'Today',    href: '/admin/today' },
  { label: 'Classes',  href: '/admin/classes' },
  { label: 'Students', href: '/admin/students', group: 'students' },
  { label: 'Content',  href: '/admin/homework', group: 'content', badge: 'homework' },
];

export function isTabActive(tab: BottomTab, groups: readonly NavGroup[], pathname: string): boolean {
  if (tab.group) return !!groups.find(g => g.id === tab.group)?.items.some(i => isActive(i, pathname));
  return pathname === tab.href || pathname.startsWith(tab.href + '/');
}

export interface NavBadges {
  homework:        number;
  enrolments:      number;
  enrolmentsStale: number; // pending enrolments older than 14 days
  essays:          number;
  errors:          number;
  bookings:        number;
  live:            { title: string; subject: string; endsAt: number } | null; // endsAt: epoch ms
}

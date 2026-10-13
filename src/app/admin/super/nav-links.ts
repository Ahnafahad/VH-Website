// Blurbs for the Command Center "Jump to" grid (labels mirror SUPER_NAV_SECTIONS in admin-nav.ts).
export const NAV_LINKS: { href: string; label: string; blurb: string }[] = [
  { href: '/admin/super/staff',       label: 'Staff manager',      blurb: 'Roles, suspend, read-only, remove, workload' },
  { href: '/admin/super/students',    label: 'Student control',    blurb: 'Overrides, merge, points, batch rollover, view as' },
  { href: '/admin/super/tests',       label: 'Tests & grading',    blurb: 'Regrade, void attempts, version history' },
  { href: '/admin/super/switches',    label: 'Feature switches',   blurb: 'Maintenance, registration, Redline' },
  { href: '/admin/super/broadcast',   label: 'Comms',              blurb: 'Push, email, banner, weekly report' },
  { href: '/admin/super/finance',     label: 'Finance',            blurb: 'Fees pipeline, revenue, money view' },
  { href: '/admin/super/ops',         label: 'Operations',         blurb: 'Deploys, storage & cost, crons, backups' },
  { href: '/admin/super/integrity',   label: 'Data integrity',     blurb: 'Schema drift, checks, exports, access queue' },
  { href: '/admin/super/sql',         label: 'SQL console',        blurb: 'Read-only queries, fully logged' },
  { href: '/admin/super/audit',       label: 'Audit log',          blurb: 'Who changed what, with diffs' },
  { href: '/admin/super/security',    label: 'Security',           blurb: 'Sign-ins, force sign-out, root lock' },
  { href: '/admin/super/permissions', label: 'Permissions',        blurb: 'What instructors can see' },
  { href: '/admin/super/approvals',   label: 'Approvals & danger', blurb: 'Delayed destructive actions' },
];

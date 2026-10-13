import { describe, it, expect } from 'vitest';
import {
  NAV_GROUPS, OVERVIEW_ITEM, BOTTOM_TABS, navForRole, groupForPath, isActive, filterItems, isTabActive,
} from './admin-nav';

const hrefs = (role: Parameters<typeof navForRole>[0]) => navForRole(role).flatMap(g => g.items.map(i => i.href));

describe('navForRole', () => {
  it('instructors never see admin-only pages', () => {
    const h = hrefs('instructor');
    for (const blocked of ['/admin/operational', '/admin/users', '/admin/registrations', '/admin/errors', '/admin/announcements', '/admin/leaderboard', '/admin/words']) {
      expect(h).not.toContain(blocked);
    }
    expect(h).toEqual(expect.arrayContaining(['/admin/today', '/admin/homework', '/admin/tests', '/admin/essays', '/admin/settings/google']));
    expect(OVERVIEW_ITEM.roles).not.toContain('instructor');
  });

  it('operational stays admin + super_admin only', () => {
    expect(hrefs('admin')).toContain('/admin/operational');
    expect(hrefs('super_admin')).toContain('/admin/operational');
    expect(hrefs('instructor')).not.toContain('/admin/operational');
  });

  it('drops groups left empty and removed items stay removed', () => {
    const all = NAV_GROUPS.flatMap(g => g.items.map(i => i.href));
    expect(all).not.toContain('/admin/vocab');
    expect(all).not.toContain('/admin/last-word');
    expect(navForRole('instructor').map(g => g.id)).toEqual(['run', 'content', 'students', 'insights', 'admin']);
    expect(navForRole('instructor', [{ id: 'admin', label: 'Admin', items: NAV_GROUPS[4].items.filter(i => i.href === '/admin/operational') }])).toEqual([]);
  });

  it('has unique hrefs and Enrolments label on /admin/registrations', () => {
    const all = NAV_GROUPS.flatMap(g => g.items);
    expect(new Set(all.map(i => i.href)).size).toBe(all.length);
    expect(all.find(i => i.href === '/admin/registrations')?.label).toBe('Enrolments');
  });
});

describe('active matching', () => {
  const groups = navForRole('admin');
  it('matches nested routes and also[] prefixes, but /admin only exactly', () => {
    expect(groupForPath(groups, '/admin/tests/12')?.id).toBe('content');
    expect(groupForPath(groups, '/admin/marathon')?.id).toBe('insights');
    expect(groupForPath(groups, '/admin/students/5')?.id).toBe('students');
    expect(isActive(OVERVIEW_ITEM, '/admin')).toBe(true);
    expect(isActive(OVERVIEW_ITEM, '/admin/today')).toBe(false);
    expect(groupForPath(groups, '/admin')).toBeUndefined();
  });

  it('bottom tabs light up by group', () => {
    const content = BOTTOM_TABS.find(t => t.label === 'Content')!;
    expect(isTabActive(content, groups, '/admin/essays')).toBe(true);
    expect(isTabActive(content, groups, '/admin/today')).toBe(false);
    expect(isTabActive(BOTTOM_TABS[0], groups, '/admin/today')).toBe(true);
  });
});

describe('filterItems', () => {
  it('matches labels case-insensitively and ignores empty queries', () => {
    const groups = navForRole('instructor');
    expect(filterItems(groups, '')).toEqual([]);
    expect(filterItems(groups, 'HOME').map(i => i.href)).toEqual(['/admin/homework']);
    expect(filterItems(groups, 'operational')).toEqual([]);
  });
});

import { describe, it, expect, vi } from 'vitest';

// admin-nav pulls in React icons and the db module needs env; neither matters for the pure matcher.
vi.mock('@/lib/db', () => ({ db: {}, lmsSettings: {} }));
vi.mock('@/components/admin/admin-nav', () => ({ INSTRUCTOR_NAV_SECTIONS: [] }));

import { isPathHidden, parseHidden, type PermSection } from '../permissions';

const sections: PermSection[] = [
  { href: '/admin/homework', label: 'Homework', group: 'TEACHING', also: [] },
  { href: '/admin/practice', label: 'Practice', group: 'X', also: ['/admin/marathon'] },
];

describe('isPathHidden', () => {
  it('matches the section, its subpaths and its also-prefixes only', () => {
    expect(isPathHidden('/admin/homework', ['/admin/homework'], sections)).toBe(true);
    expect(isPathHidden('/admin/homework/12', ['/admin/homework'], sections)).toBe(true);
    expect(isPathHidden('/admin/marathon/x', ['/admin/practice'], sections)).toBe(true);
    expect(isPathHidden('/admin/homeworkx', ['/admin/homework'], sections)).toBe(false);
    expect(isPathHidden('/admin/practice', [], sections)).toBe(false);
  });
  it('parseHidden tolerates junk', () => {
    expect(parseHidden('["/a",1]')).toEqual(['/a']);
    expect(parseHidden('nope')).toBeNull();
    expect(parseHidden(undefined)).toBeNull();
  });
});

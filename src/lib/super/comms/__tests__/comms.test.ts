import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {} }));
vi.mock('@/lib/lms/settings', () => ({ getLmsSetting: vi.fn(), setLmsSetting: vi.fn() }));

import { buildWeeklyReport } from '../report';
import { activeBanner } from '../banner';
import { filterRecipients } from '../segment';
import { summarizeEvents, warmupStatus } from '../deliverability';

const base = {
  weekEnding: '2026-10-11', newStudents: 4, registrations: 7, atRiskProxy: 12, errors7d: 3,
  failedCrons: [], cronsTracked: false, broadcasts: { sent: 2, failed: 1, scheduled: 0 },
};

describe('buildWeeklyReport', () => {
  it('renders every metric and tolerates absent cron tracking', () => {
    const r = buildWeeklyReport(base);
    expect(r.subject).toContain('2026-10-11');
    for (const s of ['New students: 4', 'Registrations: 7', 'no test activity in 14 days): 12', 'Errors logged: 3', 'not tracked yet', '2 sent, 1 failed, 0 scheduled']) {
      expect(r.text).toContain(s);
    }
  });
  it('lists failed crons and escapes html', () => {
    const r = buildWeeklyReport({ ...base, cronsTracked: true, failedCrons: ['a<b'] });
    expect(r.text).toContain('1 failed (a<b)');
    expect(r.html).toContain('a&lt;b');
  });
});

describe('activeBanner', () => {
  const live = JSON.stringify({ text: 'Hi', level: 'info', expiresAt: 2000 });
  it('returns the banner only before expiry', () => {
    expect(activeBanner(live, 1000)?.text).toBe('Hi');
    expect(activeBanner(live, 3000)).toBeNull();
  });
  it('treats empty, cleared and malformed values as no banner', () => {
    expect(activeBanner('', 1)).toBeNull();
    expect(activeBanner(null, 1)).toBeNull();
    expect(activeBanner('{nope', 1)).toBeNull();
    expect(activeBanner(JSON.stringify({ text: '', level: 'info', expiresAt: 9e12 }), 1)).toBeNull();
  });
});

describe('filterRecipients', () => {
  const r = (id: number, role: string, status = 'active') => ({ id, role, status } as never);
  it('dedupes, drops inactive, applies roles', () => {
    const rows = [r(1, 'student'), r(1, 'student'), r(2, 'student', 'inactive'), r(3, 'admin')];
    expect(filterRecipients(rows).map(x => x.id)).toEqual([1, 3]);
    expect(filterRecipients(rows, ['admin']).map(x => x.id)).toEqual([3]);
  });
});

describe('deliverability', () => {
  it('summarizes events and surfaces bounces', () => {
    const s = summarizeEvents([
      { id: '1', to: ['a@x.com'], last_event: 'delivered' },
      { id: '2', to: 'b@x.com', last_event: 'bounced', subject: 'S' },
      { id: '3', to: ['c@x.com'], last_event: 'complained' },
    ]);
    expect(s.counts).toEqual({ delivered: 1, bounced: 1, complained: 1 });
    expect(s.problems.map(p => p.id)).toEqual(['2', '3']);
  });
  it('computes warmup day and completion', () => {
    expect(warmupStatus(new Date('2026-06-10T05:00:00Z')).day).toBe(1);
    expect(warmupStatus(new Date('2026-06-23T05:00:00Z')).complete).toBe(false);
    expect(warmupStatus(new Date('2026-06-24T05:00:00Z')).complete).toBe(true);
  });
});

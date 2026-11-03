import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TestWindow } from '@/lib/db/schema';

let attempt: { startedAt: Date } | undefined;
let settings: Record<string, string> = {};
vi.mock('@/lib/db', () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ get: async () => attempt }) }) }) },
}));
vi.mock('@/lib/lms/settings', () => ({ getLmsSetting: async (k: string) => settings[k] ?? null }));

const { applyWindowOverrides, applyEssayDeadlineOverrides } = await import('../window-overrides');
const { MOCK_TRIAL } = await import('@/lib/mocks/trial');

const real = (id: number) => ({
  id, testId: 29, mode: 'online', status: 'scheduled', durationMinutes: 90,
  opensAt: new Date('2026-11-02T08:00:00Z'), closesAt: new Date('2026-11-02T10:00:00Z'),
}) as TestWindow;

describe('Mock 1 trial windows', () => {
  beforeEach(() => { attempt = undefined; settings = {}; });

  it('gives walk-ins (no attempt) the trial windows and essay deadline', async () => {
    const [w] = await applyWindowOverrides(1, [real(60)]);
    expect(w.opensAt).toEqual(MOCK_TRIAL.windows[60].opensAt);
    expect(w.closesAt).toEqual(MOCK_TRIAL.windows[60].closesAt);
    expect(w.durationMinutes).toBe(120);
    const [s] = await applyEssayDeadlineOverrides(1, [{ id: 5, deadline: new Date(0) }]);
    expect(s.deadline).toEqual(MOCK_TRIAL.essayDeadline);
  });

  it('leaves the cohort (attempt started before the trial) on the real windows', async () => {
    attempt = { startedAt: new Date('2026-11-02T08:05:00Z') };
    const [w] = await applyWindowOverrides(1, [real(60)]);
    expect(w.closesAt).toEqual(new Date('2026-11-02T10:00:00Z'));
  });

  it('a per-student override wins over the trial', async () => {
    settings.test_window_overrides = JSON.stringify([{ windowId: 60, userId: 1, closesAt: 1793728799000 }]);
    const [w] = await applyWindowOverrides(1, [real(60)]);
    expect(w.closesAt.getTime()).toBe(1793728799000);
    expect(w.opensAt).toEqual(new Date('2026-11-02T08:00:00Z'));
  });

  it('leaves other tests alone', async () => {
    const [w] = await applyWindowOverrides(1, [real(55)]);
    expect(w.closesAt).toEqual(new Date('2026-11-02T10:00:00Z'));
  });
});

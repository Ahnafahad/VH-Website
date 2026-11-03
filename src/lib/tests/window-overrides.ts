/**
 * Per-student window extensions for the online tests module.
 *
 * Test windows are test-wide; this lets staff keep one window open for one
 * student past its real close time without touching what everyone else sees.
 * Stored as JSON in the `lms_settings` row `test_window_overrides`:
 *   [{ "windowId": 45, "userId": 67, "closesAt": 1788107940000 }]  (closesAt = epoch ms)
 * Only the viewer's own copy of the window is changed (closesAt pushed out, a
 * stale 'closed' status reset), so effectiveWindowState/attemptDeadline need no
 * changes. Remove an entry to end the extension.
 */

import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { testAttempts, type TestWindow } from '@/lib/db/schema';
import { getLmsSetting } from '@/lib/lms/settings';
import { MOCK_TRIAL } from '@/lib/mocks/trial';

/** Mock 1 trial (lib/mocks/trial.ts): everyone except those who started Mock 1 before the trial sits it then. */
async function isTrialSitter(userId: number): Promise<boolean> {
  const a = await db.select({ startedAt: testAttempts.startedAt }).from(testAttempts)
    .where(and(eq(testAttempts.testId, MOCK_TRIAL.testId), eq(testAttempts.userId, userId))).get();
  return !a || a.startedAt >= MOCK_TRIAL.startsAt;
}

const KEY = 'test_window_overrides';

interface WindowOverride { windowId: number; userId: number; closesAt: number }

export async function applyWindowOverrides(userId: number, windows: TestWindow[]): Promise<TestWindow[]> {
  const raw = await getLmsSetting(KEY);
  let overrides: WindowOverride[] = [];
  try { overrides = raw ? JSON.parse(raw) : []; } catch { /* ignore malformed */ }
  if (!Array.isArray(overrides)) overrides = [];

  const trial = windows.some(w => MOCK_TRIAL.windows[w.id] && !overrides.some(x => x.userId === userId && x.windowId === w.id))
    && await isTrialSitter(userId);

  return windows.map(w => {
    const o = overrides.find(x => x.userId === userId && x.windowId === w.id);
    if (o) return { ...w, closesAt: new Date(o.closesAt), status: 'scheduled' };
    const t = trial ? MOCK_TRIAL.windows[w.id] : undefined;
    return t ? { ...w, ...t, status: 'scheduled' } : w;
  });
}

/**
 * Same idea for essay series deadlines (`lms_settings` row `essay_deadline_overrides`):
 *   [{ "seriesId": 5, "userId": 144, "deadline": 1793728799000 }]  (deadline = epoch ms)
 * Only the viewer's copy of the series moves; remove the entry to end it.
 */
interface DeadlineOverride { seriesId: number; userId: number; deadline: number }

export async function applyEssayDeadlineOverrides<S extends { id: number; deadline: Date }>(userId: number, series: S[]): Promise<S[]> {
  const raw = await getLmsSetting('essay_deadline_overrides');
  let overrides: DeadlineOverride[] = [];
  try { overrides = raw ? JSON.parse(raw) : []; } catch { /* ignore malformed */ }
  if (!Array.isArray(overrides)) overrides = [];

  const trial = series.some(s => s.id === MOCK_TRIAL.essaySeriesId && !overrides.some(x => x.userId === userId && x.seriesId === s.id))
    && await isTrialSitter(userId);

  return series.map(s => {
    const o = overrides.find(x => x.userId === userId && x.seriesId === s.id);
    if (o) return { ...s, deadline: new Date(o.deadline) };
    return trial && s.id === MOCK_TRIAL.essaySeriesId ? { ...s, deadline: MOCK_TRIAL.essayDeadline } : s;
  });
}

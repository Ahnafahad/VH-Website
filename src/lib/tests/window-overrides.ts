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

import type { TestWindow } from '@/lib/db/schema';
import { getLmsSetting } from '@/lib/lms/settings';

const KEY = 'test_window_overrides';

interface WindowOverride { windowId: number; userId: number; closesAt: number }

export async function applyWindowOverrides(userId: number, windows: TestWindow[]): Promise<TestWindow[]> {
  const raw = await getLmsSetting(KEY);
  let overrides: WindowOverride[] = [];
  try { overrides = raw ? JSON.parse(raw) : []; } catch { /* ignore malformed */ }
  if (!Array.isArray(overrides)) overrides = [];

  return windows.map(w => {
    const o = overrides.find(x => x.userId === userId && x.windowId === w.id);
    return o ? { ...w, closesAt: new Date(o.closesAt), status: 'scheduled' } : w;
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

  return series.map(s => {
    const o = overrides.find(x => x.userId === userId && x.seriesId === s.id);
    return o ? { ...s, deadline: new Date(o.deadline) } : s;
  });
}

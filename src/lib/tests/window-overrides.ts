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
  if (!raw) return windows;

  let overrides: WindowOverride[];
  try { overrides = JSON.parse(raw); } catch { return windows; }
  if (!Array.isArray(overrides)) return windows;

  return windows.map(w => {
    const o = overrides.find(x => x.userId === userId && x.windowId === w.id);
    return o ? { ...w, closesAt: new Date(o.closesAt), status: 'scheduled' } : w;
  });
}

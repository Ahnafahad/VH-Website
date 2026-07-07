/**
 * LMS settings helpers.
 * Reads and writes the `lms_settings` table (key-value store).
 * Used for feature flags like the Google Meet auto-creation toggle.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { lmsSettings } from '@/lib/db/schema';

// ─── Generic helpers ──────────────────────────────────────────────────────────

/**
 * Read a setting by key. Returns null when the row doesn't exist.
 */
export async function getLmsSetting(key: string): Promise<string | null> {
  const row = await db
    .select({ value: lmsSettings.value })
    .from(lmsSettings)
    .where(eq(lmsSettings.key, key))
    .get();
  return row?.value ?? null;
}

/**
 * Write (upsert) a setting.
 */
export async function setLmsSetting(key: string, value: string): Promise<void> {
  await db
    .insert(lmsSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: lmsSettings.key,
      set: { value, updatedAt: new Date() },
    });
}

// ─── Meet auto-create toggle ──────────────────────────────────────────────────

const MEET_AUTO_CREATE_KEY = 'meet_auto_create';

/**
 * Returns true when Google Meet should be auto-created for new classes / slots.
 * Defaults to FALSE when no row exists (feature is dormant until explicitly activated).
 */
export async function isMeetAutoCreateEnabled(): Promise<boolean> {
  const value = await getLmsSetting(MEET_AUTO_CREATE_KEY);
  if (value === null) return false; // default: disabled (activation-ready but dormant)
  return value === 'true';
}

/**
 * Enable or disable the Meet auto-create feature flag.
 */
export async function setMeetAutoCreate(enabled: boolean): Promise<void> {
  await setLmsSetting(MEET_AUTO_CREATE_KEY, enabled ? 'true' : 'false');
}

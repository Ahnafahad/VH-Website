/**
 * Shared helpers for lms_announcements.targetUserIds — a JSON array of user
 * ids stored as TEXT (NULL = cohort-targeted). Used by the admin
 * announcements-feed routes to persist and to resolve display names for the
 * individuals a given announcement targets.
 */

import { inArray } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type * as schema from '@/lib/db/schema';
import { users } from '@/lib/db/schema';

type DrizzleClient = LibSQLDatabase<typeof schema>;

export interface TargetUser {
  id: number;
  name: string;
  email: string;
}

/** Validates + normalises a raw request value into a JSON string to store, or null. */
export function encodeTargetUserIds(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const ids = value.filter((v): v is number => Number.isInteger(v));
  return ids.length > 0 ? JSON.stringify(ids) : null;
}

export function parseTargetUserIds(value: string | null): number[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is number => Number.isInteger(v)) : [];
  } catch {
    return [];
  }
}

/** Resolves ids to {id,name,email} for display, preserving the stored order. */
export async function resolveTargetUsers(db: DrizzleClient, ids: number[]): Promise<TargetUser[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(inArray(users.id, ids));
  const map = new Map(rows.map(r => [r.id, r]));
  return ids.map(id => map.get(id)).filter((r): r is TargetUser => r !== undefined);
}

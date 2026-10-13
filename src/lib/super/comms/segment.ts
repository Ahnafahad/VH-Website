/**
 * Broadcast segment = the AudienceSelection `resolveAudience` accepts, plus an optional role filter
 * applied AFTER resolution (resolveAudience has no role dimension; this is a filter, not a second resolver).
 */
import { z } from 'zod';
import { db } from '@/lib/db';
import { resolveAudience, type AudienceRecipient, type AudienceSelection } from '@/lib/audience/resolve';

const audienceSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('everyone') }),
  z.object({ mode: z.literal('batchProduct'), product: z.enum(['iba', 'fbs', 'fbs_detailed']), batch: z.string().min(1).nullable() }),
  z.object({ mode: z.literal('individuals'), userIds: z.array(z.number().int().positive()).min(1).max(500) }),
]);

export const ROLES = ['student', 'instructor', 'admin', 'super_admin'] as const;

export const segmentSchema = z.object({
  audience: audienceSchema,
  roles: z.array(z.enum(ROLES)).optional(),
});
export type Segment = { audience: AudienceSelection; roles?: (typeof ROLES)[number][] };

export const CHANNELS = ['push', 'email', 'banner'] as const;
export type Channel = (typeof CHANNELS)[number];
export const channelsSchema = z.array(z.enum(CHANNELS)).min(1).max(3);

/** Pure: dedupe by id, drop inactive accounts, apply the optional role filter. */
export function filterRecipients(rows: AudienceRecipient[], roles?: string[]): AudienceRecipient[] {
  const seen = new Set<number>();
  const out: AudienceRecipient[] = [];
  for (const r of rows) {
    if (seen.has(r.id) || r.status === 'inactive') continue;
    if (roles && roles.length > 0 && !roles.includes(r.role)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

export async function resolveSegment(segment: Segment): Promise<AudienceRecipient[]> {
  return filterRecipients(await resolveAudience(db, segment.audience), segment.roles);
}

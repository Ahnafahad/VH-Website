/**
 * resolve.ts — the single audience-resolution path for anything that sends a
 * message to a set of users (announcement email blast, LMS announcement feed,
 * and the push notifications either of those fires).
 *
 * Before this file, the email blast (api/admin/announcements) and the LMS
 * feed (api/lms/admin/announcements-feed) each computed "who gets this"
 * independently — the email blast ignored targeting entirely, the LMS feed
 * had product+batch targeting. Two audience models drift apart; this is the
 * one seam both now go through.
 *
 * `batchProduct` mode extends — does not re-encode — the existing LMS
 * visibility rule in src/lib/lms/access.ts (`lmsStudentAudienceConditions`).
 */

import { and, eq, inArray, ne } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type * as schema from '@/lib/db/schema';
import { users, userAccess } from '@/lib/db/schema';
import type { UserProduct } from '@/lib/db/schema';
import { lmsStudentAudienceConditions } from '@/lib/lms/access';

type DrizzleClient = LibSQLDatabase<typeof schema>;

// ─── Audience selection shape ──────────────────────────────────────────────

/**
 * The one audience selector shape. `batch: null` in `batchProduct` mode
 * means "every batch of this product" — same convention as
 * `lmsAnnouncements.batch` and `LmsContentScope`, never coerce it away.
 */
export type AudienceSelection =
  | { mode: 'everyone' }
  | { mode: 'batchProduct'; product: UserProduct; batch: string | null }
  | { mode: 'individuals'; userIds: number[] };

export const AUDIENCE_PRODUCTS = ['iba', 'fbs', 'fbs_detailed'] as const;

export function isAudienceProduct(value: unknown): value is UserProduct {
  return typeof value === 'string' && (AUDIENCE_PRODUCTS as readonly string[]).includes(value);
}

// ─── Recipient shape ────────────────────────────────────────────────────────

export interface AudienceRecipient {
  id: number;
  email: string;
  name: string;
  role: string;
  status: string;
  batch: string | null;
  pushSubscription: string | null;
  notifyMaterials: boolean;
  notifyAnnouncements: boolean;
  notifyCommentReply: boolean;
}

const RECIPIENT_COLUMNS = {
  id: users.id,
  email: users.email,
  name: users.name,
  role: users.role,
  status: users.status,
  batch: users.batch,
  pushSubscription: users.pushSubscription,
  notifyMaterials: users.notifyMaterials,
  notifyAnnouncements: users.notifyAnnouncements,
  notifyCommentReply: users.notifyCommentReply,
} as const;

// ─── resolveAudience ────────────────────────────────────────────────────────

/**
 * Resolves an AudienceSelection to the concrete set of recipient users.
 * This is the ONLY place recipient sets are computed — the email blast, the
 * LMS feed's push dispatch, and any future channel must call this rather than
 * re-deriving a recipient query.
 *
 * An empty/no-match selection resolves to zero recipients, never to
 * "everyone" — callers must not fall back silently.
 */
export async function resolveAudience(
  db: DrizzleClient,
  selection: AudienceSelection,
): Promise<AudienceRecipient[]> {
  switch (selection.mode) {
    case 'everyone': {
      // Preserves the email blast's original behaviour: every non-inactive
      // user, regardless of role.
      return db
        .select(RECIPIENT_COLUMNS)
        .from(users)
        .where(ne(users.status, 'inactive'));
    }

    case 'batchProduct': {
      const conditions = lmsStudentAudienceConditions({
        product: selection.product,
        batch: selection.batch,
      });
      return db
        .select(RECIPIENT_COLUMNS)
        .from(users)
        .innerJoin(userAccess, eq(userAccess.userId, users.id))
        .where(and(...conditions));
    }

    case 'individuals': {
      if (selection.userIds.length === 0) return [];
      return db
        .select(RECIPIENT_COLUMNS)
        .from(users)
        .where(inArray(users.id, selection.userIds));
    }

    default: {
      const exhaustive: never = selection;
      throw new Error(`Unhandled audience selection: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/**
 * recordAudit — writes one row to `audit_log`.
 *
 * Scaffold only (Wave 1 of the LMS v2 upgrade): no mutation route calls this
 * yet. Later waves wire it into attendance/role/suspension/marks mutations.
 */

import { db } from '@/lib/db';
import { auditLog } from '@/lib/db/schema';

export interface RecordAuditParams {
  actorUserId: number | null;
  action:      string;
  entityType:  string;
  entityId?:   number | null;
  before?:     unknown;
  after?:      unknown;
}

export async function recordAudit(params: RecordAuditParams): Promise<void> {
  const { actorUserId, action, entityType, entityId, before, after } = params;
  await db.insert(auditLog).values({
    actorUserId,
    action,
    entityType,
    entityId: entityId ?? null,
    before:   before !== undefined ? JSON.stringify(before) : null,
    after:    after !== undefined ? JSON.stringify(after) : null,
  });
}

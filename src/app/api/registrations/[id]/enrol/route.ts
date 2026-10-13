/**
 * POST /api/registrations/[id]/enrol — "Mark enrolled and grant access".
 *
 * One transaction (with the repo's shared Turso conflict retry): find or create the student's
 * user row, set their batch, grant the product access the package maps to (same grantProduct /
 * grantFullVocabAccessIfEligible path as the Users admin), and set the registration to enrolled.
 * Admin / super_admin only: granting access is an admin action, instructors are staff but not admin.
 *
 * No welcome email: the repo has no welcome-email sender (only the registration confirmation,
 * which already went out at sign-up), so none is sent here.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { batches, registrations, users } from '@/lib/db/schema';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';
import { getUserByEmail, grantProduct, clearAccessControlCache } from '@/lib/db-access-control';
import { isAdminRole } from '@/lib/auth/roles';
import { MAX_TX_ATTEMPTS, isTursoConflict } from '@/lib/db/tx-retry';
import { grantFullVocabAccessIfEligible } from '@/lib/vocab/full-access-batches';
import { assignStudentIdIfEligible } from '@/lib/students/assign-student-id';
import { recordAudit } from '@/lib/audit-log';
import { canTransition, productsForRegistration } from '@/lib/registrations/enrolment';

const bodySchema = z.object({ batch: z.string().trim().min(1).max(64) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    const auth = await validateAuth();
    const actor = await getUserByEmail(auth.email);
    if (!actor || !isAdminRole(actor.role)) throw new ApiException('Admin access required', 403);

    const { id } = await params;
    const regId = parseInt(id, 10);
    if (!regId) throw new ApiException('Invalid id', 400);

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiException('batch is required', 400);
    const batchName = parsed.data.batch;

    for (let attempt = 1; attempt <= MAX_TX_ATTEMPTS; attempt++) {
      try {
        const result = await db.transaction(async (tx) => {
          const reg = await tx.select().from(registrations).where(eq(registrations.id, regId)).get();
          if (!reg) throw new ApiException('Registration not found', 404);
          if (!canTransition(reg.status, 'enrolled')) {
            throw new ApiException(`Registration is already ${reg.status}`, 409);
          }

          const products = productsForRegistration(reg);
          if (!products.length) throw new ApiException('This registration has no course that maps to a product', 400);

          const batchRows = await tx.select({ product: batches.product }).from(batches)
            .where(and(eq(batches.name, batchName), eq(batches.status, 'active'), inArray(batches.product, products)));
          if (!batchRows.length) {
            throw new ApiException(`No active batch "${batchName}" for ${products.join(' / ')}`, 400);
          }

          const email = reg.email.trim().toLowerCase();
          let user = await tx.select().from(users).where(eq(users.email, email)).get();
          if (user && user.role !== 'student') {
            throw new ApiException('This email belongs to a staff account; grant access from Users instead', 409);
          }
          if (!user) {
            [user] = await tx.insert(users).values({
              email, name: reg.name, role: 'student', status: 'active', batch: batchName,
            }).returning();
          } else {
            await tx.update(users)
              .set({ batch: batchName, status: 'active', updatedAt: new Date() })
              .where(eq(users.id, user.id));
          }

          for (const product of products) await grantProduct(user.id, product, actor.id, tx);
          await grantFullVocabAccessIfEligible(user.id, batchName, products, tx);

          await tx.update(registrations)
            .set({ status: 'enrolled', updatedAt: new Date() })
            .where(eq(registrations.id, regId));

          return { userId: user.id, email, products };
        });

        clearAccessControlCache(result.email);
        // Student ID has its own unique-collision retry and is not essential to access, so it
        // runs after the commit (same helper the Users admin calls).
        const studentId = await assignStudentIdIfEligible(result.userId, batchName, result.products).catch(() => null);
        recordAudit({
          actorUserId: actor.id, action: 'registration.enrol', entityType: 'registration', entityId: regId,
          after: { userId: result.userId, batch: batchName, products: result.products },
        }).catch(() => {});

        return { success: true, userId: result.userId, products: result.products, batch: batchName, studentId };
      } catch (err) {
        if (err instanceof ApiException) throw err;
        if (attempt === MAX_TX_ATTEMPTS || !isTursoConflict(err)) throw err;
        await new Promise((r) => setTimeout(r, 25 * attempt));
      }
    }
    throw new ApiException('Enrolment could not be completed', 500);
  }, '/api/registrations/[id]/enrol');
}

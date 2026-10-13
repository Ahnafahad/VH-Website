import { db, users, vocabAccessRequests, vocabUserProgress } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { ApiException } from '@/lib/api-utils';

async function loadPending(reqId: number) {
  const accessReq = await db.select().from(vocabAccessRequests).where(eq(vocabAccessRequests.id, reqId)).get();
  if (!accessReq) throw new ApiException('Access request not found', 404);
  if (accessReq.status !== 'pending') throw new ApiException(`Request already ${accessReq.status}`, 409);
  return accessReq;
}

/** Approves a LexiCore access request: upgrades the user's vocab phase to 1 and marks the request approved. */
export async function approveVocabAccessRequest(reqId: number): Promise<void> {
  const accessReq = await loadPending(reqId);
  const user = await db.select({ id: users.id }).from(users).where(eq(users.id, accessReq.userId)).get();
  if (!user) throw new ApiException('User not found', 404);

  const existing = await db.select({ id: vocabUserProgress.id }).from(vocabUserProgress)
    .where(eq(vocabUserProgress.userId, accessReq.userId)).get();
  if (existing) {
    await db.update(vocabUserProgress).set({ phase: 1, updatedAt: new Date() }).where(eq(vocabUserProgress.userId, accessReq.userId));
  } else {
    await db.insert(vocabUserProgress).values({ userId: accessReq.userId, phase: 1 });
  }
  await db.update(vocabAccessRequests).set({ status: 'approved', updatedAt: new Date() }).where(eq(vocabAccessRequests.id, reqId));
}

export async function rejectVocabAccessRequest(reqId: number): Promise<void> {
  await loadPending(reqId);
  await db.update(vocabAccessRequests).set({ status: 'rejected', updatedAt: new Date() }).where(eq(vocabAccessRequests.id, reqId));
}

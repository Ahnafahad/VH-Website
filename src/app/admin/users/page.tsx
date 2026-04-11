import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, users, userAccess, vocabUserProgress, vocabAccessRequests } from '@/lib/db';
import type { UserAccess, VocabUserProgress } from '@/lib/db/schema';
import { eq, desc, and, inArray } from 'drizzle-orm';
import UsersClient from '@/components/admin/UsersClient';
import type { AdminUserRow, AdminAccessRequest } from '@/components/admin/UsersClient';

export const metadata = { title: 'Users — VH Admin' };

// Fetch first page of users with vocab progress joined
async function fetchInitialUsers(): Promise<{ users: AdminUserRow[]; total: number }> {
  const rows = await db
    .select()
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(20);

  const ids = rows.map(u => u.id);

  const [accessRows, progressRows] = await Promise.all([
    ids.length
      ? db.select().from(userAccess).where(and(inArray(userAccess.userId, ids), eq(userAccess.active, true)))
      : ([] as UserAccess[]),
    ids.length
      ? db.select().from(vocabUserProgress).where(inArray(vocabUserProgress.userId, ids))
      : ([] as VocabUserProgress[]),
  ]);

  const productMap  = new Map<number, string[]>();
  const progressMap = new Map<number, VocabUserProgress>();

  for (const a of accessRows) {
    if (!productMap.has(a.userId)) productMap.set(a.userId, []);
    productMap.get(a.userId)!.push(a.product);
  }
  for (const p of progressRows) {
    progressMap.set(p.userId, p);
  }

  // Count total (approximate — server-side only for initial render)
  const allIds = await db.select({ id: users.id }).from(users);
  const total  = allIds.length;

  const result: AdminUserRow[] = rows.map(u => {
    const prog = progressMap.get(u.id);
    return {
      id:            u.id,
      name:          u.name,
      email:         u.email,
      role:          u.role,
      status:        u.status,
      studentId:     u.studentId ?? null,
      batch:         u.batch ?? null,
      createdAt:     u.createdAt instanceof Date ? u.createdAt.toISOString() : String(u.createdAt),
      products:      (productMap.get(u.id) ?? []) as ('iba' | 'fbs' | 'fbs_detailed')[],
      totalPoints:   prog?.totalPoints   ?? 0,
      streakDays:    prog?.streakDays    ?? 0,
      lastStudyDate: prog?.lastStudyDate instanceof Date
        ? prog.lastStudyDate.toISOString()
        : prog?.lastStudyDate
          ? String(prog.lastStudyDate)
          : null,
    };
  });

  return { users: result, total };
}

// Fetch pending access requests
async function fetchAccessRequests(): Promise<AdminAccessRequest[]> {
  const rows = await db
    .select({
      id:        vocabAccessRequests.id,
      userId:    vocabAccessRequests.userId,
      whatsapp:  vocabAccessRequests.whatsapp,
      message:   vocabAccessRequests.message,
      status:    vocabAccessRequests.status,
      createdAt: vocabAccessRequests.createdAt,
      userName:  users.name,
      userEmail: users.email,
    })
    .from(vocabAccessRequests)
    .innerJoin(users, eq(vocabAccessRequests.userId, users.id))
    .where(eq(vocabAccessRequests.status, 'pending'))
    .orderBy(desc(vocabAccessRequests.createdAt));

  return rows.map(r => ({
    id:        r.id,
    userId:    r.userId,
    whatsapp:  r.whatsapp ?? null,
    message:   r.message  ?? null,
    status:    r.status,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    userName:  r.userName,
    userEmail: r.userEmail,
  }));
}

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role || (session.user.role !== 'admin' && session.user.role !== 'super_admin')) {
    redirect('/auth/signin');
  }

  const [initialData, accessRequests] = await Promise.all([
    fetchInitialUsers(),
    fetchAccessRequests(),
  ]);

  return (
    <UsersClient
      initialUsers={initialData.users}
      initialTotal={initialData.total}
      initialAccessRequests={accessRequests}
    />
  );
}

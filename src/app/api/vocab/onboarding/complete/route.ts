import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { db, users, vocabUserProgress } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({
  deadline:    z.string().datetime().optional(),
  wordsPerDay: z.number().int().positive().optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const deadline     = parsed.data.deadline ? new Date(parsed.data.deadline) : null;
  const daysUntil    = deadline
    ? Math.max(1, Math.ceil((deadline.getTime() - Date.now()) / 86400000))
    : 30; // sensible default when no deadline provided
  // wordsPerDay, if provided by the client, caps/floors the server-computed target
  const computedTarget = Math.ceil(800 / daysUntil);
  const dailyTarget    = parsed.data.wordsPerDay
    ? Math.max(1, Math.min(parsed.data.wordsPerDay, 800))
    : computedTarget;

  // Determine phase based on cut-off date setting
  // Default to phase 2 for new users; admins can upgrade
  await db
    .insert(vocabUserProgress)
    .values({
      userId:             user.id,
      phase:              2,
      deadline,
      dailyTarget,
      onboardingComplete: true,
    })
    .onConflictDoUpdate({
      target: vocabUserProgress.userId,
      set: {
        deadline,
        dailyTarget,
        onboardingComplete: true,
        updatedAt:          new Date(),
      },
    });

  return NextResponse.json({ ok: true });
}

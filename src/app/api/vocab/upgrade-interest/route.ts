import { NextRequest } from 'next/server';
import { safeApiHandler, validateAuth } from '@/lib/api-utils';
import { db, users, vocabUpgradeRequests } from '@/lib/db';
import { eq } from 'drizzle-orm';

const VALID_OPTIONS = ['tutor', 'printing', 'notebook', 'nothing'] as const;
type ValidOption = typeof VALID_OPTIONS[number];

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const session = await validateAuth();

    const body = await req.json() as { selectedOption?: string };
    const option = body.selectedOption as ValidOption;

    if (!VALID_OPTIONS.includes(option)) {
      throw new Error('Invalid option');
    }

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, session.email))
      .limit(1);

    if (!user) throw new Error('User not found');

    await db
      .insert(vocabUpgradeRequests)
      .values({ userId: user.id, selectedOption: option })
      .onConflictDoUpdate({
        target: vocabUpgradeRequests.userId,
        set: { selectedOption: option, submittedAt: new Date() },
      });

    return { ok: true };
  });
}

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, users } from '@/lib/db';
import { ApiException, safeApiHandler, validateAuth } from '@/lib/api-utils';
import { DatabaseLastWordPersistence } from '@/features/last-word/persistence/database';
import { parseSubmission } from '@/features/last-word/persistence/submission';
import { PersistenceValidationError } from '@/features/last-word/persistence/types';

export const dynamic = 'force-dynamic';

async function authenticatedPersistence() {
  const { email } = await validateAuth();
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  if (!user) throw new ApiException('User not found', 404);
  return new DatabaseLastWordPersistence(db, user.id);
}

export async function GET() {
  return safeApiHandler(async () => (await authenticatedPersistence()).load());
}

export async function POST(request: NextRequest) {
  return safeApiHandler(async () => {
    const persistence = await authenticatedPersistence();
    const body = await request.text();
    if (body.length > 200_000) throw new ApiException('Session payload is too large.', 413);
    try {
      const submission = parseSubmission(JSON.parse(body));
      if (submission.completedAt > Date.now() + 60_000) throw new PersistenceValidationError('Session timestamp is in the future.');
      return await persistence.saveSession(submission);
    } catch (error) {
      if (error instanceof PersistenceValidationError || error instanceof SyntaxError) throw new ApiException(error.message, 400, 'INVALID_SESSION');
      throw error;
    }
  });
}

import { validateAuth, safeApiHandler } from '@/lib/api-utils';
import { getDailyMessage } from '@/lib/vocab/daily-message';

export async function GET() {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();
    return getDailyMessage(email);
  });
}

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { isEmailAuthorized } from '@/lib/db-access-control';
import { logVocabErrorSafe } from '@/lib/vocab/error-log';

export interface ApiError {
  message: string;
  status: number;
  code?: string;
}

export class ApiException extends Error {
  public status: number;
  public code?: string;

  constructor(message: string, status: number = 500, code?: string) {
    super(message);
    this.name = 'ApiException';
    this.status = status;
    this.code = code;
  }
}

export function createErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiException) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof Error) {
    console.error('[API Error]', error.message, error.stack);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
}

export async function validateAuth(): Promise<{ email: string; name?: string }> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new ApiException('Authentication required', 401, 'AUTH_REQUIRED');
  }

  const email = session.user.email.toLowerCase();
  const isAuthorized = await isEmailAuthorized(email);

  if (!isAuthorized) {
    throw new ApiException('Access denied', 403, 'ACCESS_DENIED');
  }

  return { email: session.user.email, name: session.user.name || undefined };
}

// Routes rarely pass a context, so recover the route from the stack: production frames look like
// ".../.next/server/app/api/admin/tests/route.js". Falls back to a generic label.
function routeFromStack(error: unknown): string {
  const stack = (error instanceof Error ? error.stack ?? '' : '').split('\\').join('/');
  const match = stack.match(/\/app\/(api\/[^:()]*?)\/route\.[cm]?[jt]s/);
  return match ? '/' + match[1] : 'api (route unknown)';
}

export async function safeApiHandler<T>(
  handler: () => Promise<T>,
  context?: string,
): Promise<NextResponse> {
  try {
    const result = await handler();
    return NextResponse.json(result);
  } catch (error) {
    // Log 500-class failures to vocab_error_logs for every route (the table backs /admin/errors).
    // 4xx ApiExceptions (auth noise, validation) are intentionally skipped.
    {
      const is5xx =
        error instanceof ApiException ? error.status >= 500 : error instanceof Error;
      if (is5xx) {
        logVocabErrorSafe({
          source:  'api',
          severity: 'error',
          context: context ?? routeFromStack(error),
          message: error instanceof Error ? error.message : String(error),
          detail: {
            stack:  error instanceof Error ? error.stack : undefined,
            status: error instanceof ApiException ? error.status : 500,
            code:   error instanceof ApiException ? error.code : undefined,
          },
        });
      }
    }
    return createErrorResponse(error);
  }
}

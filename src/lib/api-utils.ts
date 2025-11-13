import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { isEmailAuthorized } from '@/lib/db-access-control';

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
  console.error('API Error:', error);

  if (error instanceof ApiException) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code
      },
      { status: error.status }
    );
  }

  if (error instanceof Error) {
    // Don't expose internal errors in production
    const isDev = process.env.NODE_ENV === 'development';
    return NextResponse.json(
      {
        error: isDev ? error.message : 'Internal server error',
        details: isDev ? { stack: error.stack } : undefined
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { error: 'An unexpected error occurred' },
    { status: 500 }
  );
}

export async function validateAuth(): Promise<{ email: string; name?: string }> {
  try {
    console.log('[validateAuth] Starting validation...');
    const session = await getServerSession(authOptions);
    console.log('[validateAuth] Session retrieved:', session?.user?.email || 'No session');

    if (!session?.user?.email) {
      console.error('[validateAuth] No session or email found');
      throw new ApiException('Authentication required', 401, 'AUTH_REQUIRED');
    }

    const email = session.user.email.toLowerCase();
    console.log('[validateAuth] Checking authorization for:', email);

    const isAuthorized = await isEmailAuthorized(email);
    console.log('[validateAuth] Authorization check result:', isAuthorized);

    if (!isAuthorized) {
      console.error('[validateAuth] User not authorized:', email);
      throw new ApiException('Access denied', 403, 'ACCESS_DENIED');
    }

    console.log('[validateAuth] Validation successful for:', email);
    return {
      email: session.user.email,
      name: session.user.name || undefined
    };
  } catch (error) {
    if (error instanceof ApiException) {
      throw error;
    }
    console.error('[validateAuth] Unexpected error:', error);
    throw new ApiException('Authentication failed', 401, 'AUTH_FAILED');
  }
}

export function validateEnvironment(): void {
  const requiredEnvVars = ['MONGODB_URI', 'NEXTAUTH_SECRET'];
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);

  if (missing.length > 0) {
    throw new ApiException(
      `Missing required environment variables: ${missing.join(', ')}`,
      500,
      'ENV_MISSING'
    );
  }
}

export async function safeApiHandler<T>(
  handler: () => Promise<T>
): Promise<NextResponse> {
  try {
    // Validate environment first
    validateEnvironment();

    const result = await handler();
    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
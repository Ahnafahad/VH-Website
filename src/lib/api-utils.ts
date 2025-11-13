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
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      throw new ApiException('Authentication required', 401, 'AUTH_REQUIRED');
    }

    const isAuthorized = await isEmailAuthorized(session.user.email.toLowerCase());
    if (!isAuthorized) {
      throw new ApiException('Access denied', 403, 'ACCESS_DENIED');
    }

    return {
      email: session.user.email,
      name: session.user.name || undefined
    };
  } catch (error) {
    if (error instanceof ApiException) {
      throw error;
    }
    console.error('Auth validation error:', error);
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
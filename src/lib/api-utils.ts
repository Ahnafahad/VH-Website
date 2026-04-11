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

export async function safeApiHandler<T>(handler: () => Promise<T>): Promise<NextResponse> {
  try {
    const result = await handler();
    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}

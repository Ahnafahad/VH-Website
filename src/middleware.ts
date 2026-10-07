import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Read-only staff accounts (users.read_only) may call any GET endpoint but no write endpoint.
// Enforced here, in one place, so no individual API route has to remember to check.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
// Sign-in/out and passive analytics must keep working or the account could not even log in.
const ALWAYS_ALLOWED = ['/api/auth/', '/api/analytics/ingest'];

export async function middleware(req: NextRequest) {
  if (SAFE_METHODS.has(req.method)) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (ALWAYS_ALLOWED.some(p => pathname.startsWith(p))) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (token?.readOnly) {
    return NextResponse.json(
      { error: 'Read-only access: changes are disabled for this account.' },
      { status: 403 },
    );
  }
  return NextResponse.next();
}

export const config = { matcher: '/api/:path*' };

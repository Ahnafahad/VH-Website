import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { VIEW_AS_COOKIE, verifyViewAs, blockedWhileViewingAs } from '@/lib/super/security/view-as';

// Read-only staff accounts (users.read_only) may call any GET endpoint but no write endpoint.
// Enforced here, in one place, so no individual API route has to remember to check.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
// Sign-in/out and passive analytics must keep working or the account could not even log in.
const ALWAYS_ALLOWED = ['/api/auth/', '/api/analytics/ingest'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith('/api/')) {
    // /admin page request: expose the path so the admin layout (a server component) can read it.
    const headers = new Headers(req.headers);
    headers.set('x-pathname', pathname);
    return NextResponse.next({ request: { headers } });
  }
  if (SAFE_METHODS.has(req.method)) return NextResponse.next();
  if (ALWAYS_ALLOWED.some(p => pathname.startsWith(p))) return NextResponse.next();

  // Super-admin "view as": the session shows another user's identity, so nothing may be written.
  const viewAs = await verifyViewAs(req.cookies.get(VIEW_AS_COOKIE)?.value, process.env.NEXTAUTH_SECRET);
  if (viewAs && blockedWhileViewingAs(req.method, pathname)) {
    return NextResponse.json({ error: 'Read-only while viewing as another user' }, { status: 403 });
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (token?.readOnly) {
    return NextResponse.json(
      { error: 'Read-only access: changes are disabled for this account.' },
      { status: 403 },
    );
  }
  return NextResponse.next();
}

export const config = { matcher: ['/api/:path*', '/admin/:path*'] };

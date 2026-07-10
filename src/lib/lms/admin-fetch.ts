import { cookies } from 'next/headers';

/**
 * Server-side fetch to our own admin API that forwards the caller's
 * NextAuth session cookie, so requireStaff()-guarded routes authenticate.
 * Use only inside Server Components / server actions.
 */
export async function adminApiFetch(path: string): Promise<Response> {
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:6960';
  const cookieHeader = (await cookies()).toString();
  return fetch(`${base}${path}`, {
    cache: 'no-store',
    headers: { cookie: cookieHeader },
  });
}

/**
 * "View as" cookie: HMAC-signed {actorId, targetId, exp}. Edge-safe (Web Crypto only) so
 * middleware.ts can verify it too. The cookie alone grants nothing — the session callback
 * re-checks that the real token user is still an active super_admin.
 */
export const VIEW_AS_COOKIE = 'vh_view_as';
export const VIEW_AS_TTL_S = 30 * 60;

export interface ViewAsPayload { a: number; t: number; e: number } // actorId, targetId, exp (epoch s)

const enc = new TextEncoder();
const b64u = (buf: ArrayBuffer | string) => {
  const bytes = typeof buf === 'string' ? enc.encode(buf) : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64u = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
};

async function hmac(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
}

export async function signViewAs(p: ViewAsPayload, secret: string): Promise<string> {
  const body = b64u(JSON.stringify(p));
  return `${body}.${await hmac(body, secret)}`;
}

/** Returns the payload only if the signature matches and it has not expired; otherwise null. */
export async function verifyViewAs(value: string | undefined | null, secret: string | undefined, nowS = Math.floor(Date.now() / 1000)): Promise<ViewAsPayload | null> {
  if (!value || !secret) return null;
  const [body, sig] = value.split('.');
  if (!body || !sig) return null;
  try {
    const expected = await hmac(body, secret);
    if (expected.length !== sig.length) return null;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    if (diff !== 0) return null;
    const p = JSON.parse(fromB64u(body)) as ViewAsPayload;
    if (typeof p.a !== 'number' || typeof p.t !== 'number' || typeof p.e !== 'number' || p.e <= nowS) return null;
    return p;
  } catch {
    return null;
  }
}

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/** True when a request must be rejected because the caller is currently viewing as someone else. */
export function blockedWhileViewingAs(method: string, pathname: string): boolean {
  if (SAFE.has(method)) return false;
  if (pathname.startsWith('/api/auth/') || pathname.startsWith('/api/analytics/ingest')) return false;
  if (method === 'DELETE' && pathname === '/api/admin/super/impersonate') return false;
  return true;
}

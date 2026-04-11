/**
 * Access control layer — backed by Turso (libSQL).
 * Single source of truth: users + user_access tables.
 * 60-second per-email cache to reduce DB round-trips.
 */
import { db } from '@/lib/db';
import { users, userAccess } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type { UserWithProducts, UserProduct } from '@/lib/db/schema';

// ─── Cache ────────────────────────────────────────────────────────────────────

interface CacheEntry {
  user: UserWithProducts | null;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

export function clearAccessControlCache(email?: string) {
  if (email) {
    cache.delete(email.toLowerCase());
  } else {
    cache.clear();
  }
}

// ─── Core lookup ─────────────────────────────────────────────────────────────

export async function getCachedUser(email: string): Promise<UserWithProducts | null> {
  const key = email.toLowerCase();
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.user;

  const user = await fetchUserWithProducts(key);
  cache.set(key, { user, expiresAt: now + CACHE_TTL_MS });
  return user;
}

async function fetchUserWithProducts(email: string): Promise<UserWithProducts | null> {
  const row = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.status, 'active')))
    .get();

  if (!row) return null;

  const access = await db
    .select({ product: userAccess.product })
    .from(userAccess)
    .where(and(eq(userAccess.userId, row.id), eq(userAccess.active, true)));

  return {
    ...row,
    products: access.map(a => a.product as UserProduct),
  };
}

// ─── Access checks ────────────────────────────────────────────────────────────

export async function isEmailAuthorized(email: string): Promise<boolean> {
  const user = await getCachedUser(email.toLowerCase());
  return user !== null;
}

export async function isAdminEmail(email: string): Promise<boolean> {
  const user = await getCachedUser(email.toLowerCase());
  return user?.role === 'admin' || user?.role === 'super_admin';
}

export async function isSuperAdminEmail(email: string): Promise<boolean> {
  const user = await getCachedUser(email.toLowerCase());
  return user?.role === 'super_admin';
}

export async function getUserByEmail(email: string): Promise<UserWithProducts | null> {
  return getCachedUser(email.toLowerCase());
}

export async function getUserById(id: number): Promise<UserWithProducts | null> {
  const row = await db.select().from(users).where(eq(users.id, id)).get();
  if (!row) return null;
  const access = await db
    .select({ product: userAccess.product })
    .from(userAccess)
    .where(and(eq(userAccess.userId, row.id), eq(userAccess.active, true)));
  return { ...row, products: access.map(a => a.product as UserProduct) };
}

// ─── Product/access helpers ───────────────────────────────────────────────────

/** Derive legacy accessTypes + mockAccess from the products array */
export function computeAccessFromProducts(user: UserWithProducts) {
  const isAdmin = user.role === 'admin' || user.role === 'super_admin';
  const p = user.products;
  return {
    accessTypes: {
      IBA: isAdmin || p.includes('iba'),
      FBS: isAdmin || p.includes('fbs'),
    },
    mockAccess: {
      duIba:       isAdmin || p.includes('iba'),
      bupIba:      isAdmin || p.includes('iba'),
      duFbs:       isAdmin || p.includes('fbs'),
      bupFbs:      isAdmin || p.includes('fbs'),
      fbsDetailed: isAdmin || p.includes('fbs_detailed'),
    },
  };
}

export async function hasProduct(email: string, product: UserProduct): Promise<boolean> {
  const user = await getCachedUser(email.toLowerCase());
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'super_admin') return true;
  return user.products.includes(product);
}

// ─── Admin product-grant helpers ──────────────────────────────────────────────

export async function grantProduct(userId: number, product: UserProduct, grantedBy?: number) {
  await db
    .insert(userAccess)
    .values({ userId, product, active: true, grantedBy })
    .onConflictDoUpdate({
      target: [userAccess.userId, userAccess.product],
      set: { active: true, grantedBy },
    });
  clearAccessControlCache();
}

export async function revokeProduct(userId: number, product: UserProduct) {
  await db
    .update(userAccess)
    .set({ active: false })
    .where(and(eq(userAccess.userId, userId), eq(userAccess.product, product)));
  clearAccessControlCache();
}

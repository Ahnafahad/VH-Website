/**
 * Simple in-memory rate limiter compatible with Vercel serverless.
 * Note: resets per cold start — adequate for basic abuse protection.
 * For stronger guarantees use a Redis-backed limiter (e.g. Upstash).
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const attempts = new Map<string, RateLimitEntry>();

/**
 * Check whether the given key is within its rate limit.
 * @param key        Unique identifier, e.g. `${userId}:${routeName}`
 * @param maxAttempts Maximum number of requests allowed in the window
 * @param windowMs   Time window in milliseconds
 * @returns true if the request is allowed, false if it should be rejected
 */
export function rateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): boolean {
  const now   = Date.now();
  const entry = attempts.get(key);

  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxAttempts) return false;

  entry.count++;
  return true;
}

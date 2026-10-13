/**
 * Root-account lock. True when `changes` would demote, suspend, re-email, make read-only or delete
 * the root account. Pure: callers pass isRootEmail(...) and throw ApiException(403) themselves.
 */
export function rootLockViolation(isRoot: boolean, changes: { role?: unknown; status?: unknown; email?: unknown; readOnly?: unknown; delete?: boolean }): boolean {
  if (!isRoot) return false;
  if (changes.delete) return true;
  if (changes.role !== undefined && changes.role !== 'super_admin') return true;
  if (changes.status !== undefined && changes.status !== 'active') return true;
  if (changes.readOnly) return true;
  if (typeof changes.email === 'string' && changes.email.toLowerCase().trim() !== 'ahnaf816@gmail.com') return true;
  return false;
}

export const ROOT_PROTECTED_MESSAGE = 'This account is protected';

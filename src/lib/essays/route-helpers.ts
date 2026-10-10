import { ApiException } from '@/lib/api-utils';
import type { UserWithProducts } from '@/lib/db/schema';
import { requireUser } from '@/lib/tests/route-helpers';
import { isEssayAdmin, isEssayStaff } from './access';

export { requireUser };

export async function requireEssayStaff(): Promise<UserWithProducts> {
  const user = await requireUser();
  if (!isEssayStaff(user)) {
    throw new ApiException('Instructor or admin access required', 403, 'FORBIDDEN');
  }
  return user;
}

export async function requireEssayAdmin(): Promise<UserWithProducts> {
  const user = await requireUser();
  if (!isEssayAdmin(user)) {
    throw new ApiException('Admin access required', 403, 'FORBIDDEN');
  }
  return user;
}

export function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new ApiException('Invalid id', 400);
  return id;
}

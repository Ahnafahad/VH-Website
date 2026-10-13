'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * The admin layout does not re-run on client-side navigation, so its server redirect only covers
 * hard loads. This catches in-app clicks to a page the super admin has hidden from this instructor.
 */
export default function InstructorPageGuard({ prefixes, home }: { prefixes: string[]; home: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const blocked = prefixes.some(p => pathname === p || pathname.startsWith(p + '/'));
  useEffect(() => { if (blocked) router.replace(home); }, [blocked, home, router]);
  return null;
}

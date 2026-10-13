'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Never gated: sign-in, every admin page, API, the notice page itself, dev login.
const EXEMPT = ['/auth', '/admin', '/api', '/maintenance', '/dev-login'];

/** Sends students to /maintenance while maintenance mode is on. Staff and anonymous visitors are unaffected. */
export default function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (EXEMPT.some(p => pathname.startsWith(p))) return;
    let live = true;
    fetch('/api/site-status', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (live && d.blocked) { setBlocked(true); router.replace('/maintenance'); } })
      .catch(() => {});
    return () => { live = false; };
  }, [pathname, router]);

  return blocked ? null : <>{children}</>;
}

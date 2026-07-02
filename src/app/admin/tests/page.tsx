'use client';

/**
 * /admin/tests — Online Tests admin panel
 * Guard: session.user.isAdmin (true for admin, super_admin, instructor)
 */

import { useEffect } from 'react';
import { useSession }  from 'next-auth/react';
import { useRouter }   from 'next/navigation';
import { Loader2 }     from 'lucide-react';
import TestsAdminPage  from '@/components/admin/tests/TestsAdminPage';

export default function AdminTestsRoute() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
    if (status === 'authenticated' && !session?.user?.isAdmin) router.push('/');
  }, [status, session, router]);

  if (
    status === 'loading' ||
    status === 'unauthenticated' ||
    (status === 'authenticated' && !session?.user?.isAdmin)
  ) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: '#D62B38' }} />
        <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
      </div>
    );
  }

  const isAdmin =
    session?.user?.role === 'admin' || session?.user?.role === 'super_admin';

  return <TestsAdminPage isAdmin={isAdmin} />;
}

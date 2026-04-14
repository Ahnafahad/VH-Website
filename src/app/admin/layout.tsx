import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminMobileHeader from '@/components/admin/AdminMobileHeader';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ── Auth guard (server-side) ────────────────────────────────────────────────
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect('/auth/signin');
  }

  const role = session.user.role;
  if (role !== 'admin' && role !== 'super_admin' && role !== 'instructor') {
    redirect('/vocab');
  }

  const adminName  = session.user.name  ?? 'Admin';
  const adminEmail = session.user.email ?? '';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display:     'flex',
        minHeight:   '100dvh',
        background:  '#FFFFFF',
        colorScheme: 'light',
      }}
    >
      {/* Fixed left sidebar — desktop only */}
      <AdminSidebar adminName={adminName} adminEmail={adminEmail} />

      {/* Fixed top bar — mobile only */}
      <AdminMobileHeader adminName={adminName} adminEmail={adminEmail} />

      {/* Main content area */}
      <main
        style={{
          flex:       1,
          minHeight:  '100dvh',
          background: '#FFFFFF',
          // Desktop: offset for sidebar; mobile: offset for top bar
          // Using inline style so we avoid Tailwind's md: prefix requirement
        }}
        className="md:ml-60 pt-14 md:pt-0"
      >
        <div
          style={{
            padding:   '24px',
            maxWidth:  '100%',
          }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}

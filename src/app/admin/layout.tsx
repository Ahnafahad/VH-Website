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
  const staffRole  = role as 'super_admin' | 'admin' | 'instructor';

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
      <AdminSidebar adminName={adminName} adminEmail={adminEmail} role={staffRole} />

      {/* Fixed top bar — mobile only */}
      <AdminMobileHeader adminName={adminName} adminEmail={adminEmail} role={staffRole} />

      {/* Main content area */}
      {/*
        Responsive offsets are declared via an inline <style> block so they are
        guaranteed to be in the HTML, regardless of Tailwind CSS extraction.

        Mobile (< 768 px): fixed top bar is 56 px tall → paddingTop: 56px
        Desktop (≥ 768 px): sidebar is 240 px wide → marginLeft: 240px, no top padding
      */}
      <style>{`
        #admin-main { margin-left: 0; padding-top: 56px; }
        @media (min-width: 768px) { #admin-main { margin-left: 240px; padding-top: 0; } }
      `}</style>
      <main
        id="admin-main"
        style={{
          flex:       1,
          minHeight:  '100dvh',
          background: '#FFFFFF',
        }}
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

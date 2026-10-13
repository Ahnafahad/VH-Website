import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminMobileHeader from '@/components/admin/AdminMobileHeader';
import AdminMotionConfig from '@/components/admin/AdminMotionConfig';
import { AdminProductProvider } from '@/components/admin/AdminProductContext';
import { getUserByEmail } from '@/lib/db-access-control';
import InstructorPageGuard from '@/components/admin/super/security/InstructorPageGuard';
import { getInstructorHidden, isPathHidden, hiddenPrefixes, INSTRUCTOR_HOME } from '@/lib/super/security/permissions';

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

  // Super-admin-configured page hiding for instructors (page-level only; see /admin/super/permissions).
  let hiddenForInstructor: string[] = [];
  if (role === 'instructor') {
    const pathname = (await headers()).get('x-pathname') ?? '';
    const me = await getUserByEmail(session.user.email);
    const hidden = me ? await getInstructorHidden(me.id) : [];
    if (pathname && pathname !== INSTRUCTOR_HOME && isPathHidden(pathname, hidden)) redirect(INSTRUCTOR_HOME);
    hiddenForInstructor = hiddenPrefixes(hidden);
  }

  const adminName  = session.user.name  ?? 'Admin';
  const adminEmail = session.user.email ?? '';
  const staffRole  = role as 'super_admin' | 'admin' | 'instructor';
  const readOnly   = !!session.user.readOnly;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AdminMotionConfig>
    <AdminProductProvider>
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

        Mobile (< 768 px): fixed top bar and bottom bar are 56 px tall each
        Desktop (≥ 768 px): sidebar is 240 px wide → marginLeft: 240px, no top padding
      */}
      <style>{`
        #admin-main { margin-left: 0; padding-top: 56px; padding-bottom: calc(56px + env(safe-area-inset-bottom)); }
        @media (min-width: 768px) { #admin-main { margin-left: 240px; padding-top: 0; padding-bottom: 0; } }
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
          {readOnly && (
            <p role="status" style={{ margin: '0 0 16px', padding: '10px 14px', borderRadius: 8, border: '1px solid #E1D4CB', background: '#FAF5EF', color: '#3D1A10', fontSize: 13 }}>
              <strong>Read-only access.</strong> You can view everything here, but any change you try to save will be rejected.
            </p>
          )}
          {hiddenForInstructor.length > 0 && <InstructorPageGuard prefixes={hiddenForInstructor} home={INSTRUCTOR_HOME} />}
          {children}
        </div>
      </main>
    </div>
    </AdminProductProvider>
    </AdminMotionConfig>
  );
}

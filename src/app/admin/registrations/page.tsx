/**
 * /admin/registrations — Enrolments (the cleaned-up Registrations page).
 * Server Component: loads registrations + active batches, hands them to the client inbox.
 * The Students tab was a duplicate of Users; Free Signups is now a segment on /admin/users.
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { batches, registrations } from '@/lib/db/schema';
import { isAdminRole, isStaffRole } from '@/lib/auth/roles';
import EnrolmentsClient, { type EnrolmentRow, type EnrolmentBatch } from '@/components/admin/enrolments/EnrolmentsClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Enrolments | Admin' };

export default async function AdminEnrolmentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');
  if (!isStaffRole(session.user.role)) redirect('/auth/signin');

  const [rows, batchRows] = await Promise.all([
    db.select().from(registrations).orderBy(desc(registrations.createdAt)).limit(500),
    // The batches table may not exist in every environment; degrade to no batch choices.
    db.select({ id: batches.id, name: batches.name, product: batches.product }).from(batches)
      .where(eq(batches.status, 'active')).catch(() => [] as EnrolmentBatch[]),
  ]);

  const initial: EnrolmentRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    educationType: r.educationType,
    hscYear: r.hscYear, sscYear: r.sscYear, aLevelYear: r.aLevelYear, oLevelYear: r.oLevelYear,
    programMode: r.programMode,
    selectedMocks: r.selectedMocks,
    selectedFullCourses: r.selectedFullCourses,
    mockIntent: r.mockIntent,
    pricingSubtotal: r.pricingSubtotal,
    pricingDiscount: r.pricingDiscount,
    pricingFinalPrice: r.pricingFinalPrice,
    referralName: r.referralName,
    referralInstitution: r.referralInstitution,
    referralBatch: r.referralBatch,
    status: r.status,
    studentEmailStatus: r.studentEmailStatus,
    adminEmailStatus: r.adminEmailStatus,
    createdAtMs: r.createdAt instanceof Date ? r.createdAt.getTime() : Number(r.createdAt) * 1000,
  }));

  return (
    <EnrolmentsClient
      initialRows={initial}
      batches={batchRows}
      canEnrol={isAdminRole(session.user.role)}
    />
  );
}

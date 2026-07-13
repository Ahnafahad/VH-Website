/**
 * /dashboard/materials/[id] — PDF viewer with anchored highlights.
 * Server component: session guard → scope check → fetch highlights → render client.
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { getServerSession } from 'next-auth';
import { and, asc, eq } from 'drizzle-orm';
import { authOptions } from '@/lib/auth';
import { getUserByEmail } from '@/lib/db-access-control';
import { db } from '@/lib/db';
import { materials, materialHighlights } from '@/lib/db/schema';
import { canAccessLmsContent } from '@/lib/lms/access';
import MaterialViewer from '@/components/lms/MaterialViewer';
import { resolveFileUrl } from '@/lib/storage/r2';
import type { ScaledPosition } from 'react-pdf-highlighter-extended';

export interface SerializedHighlight {
  id: number;
  materialId: number;
  pageNumber: number;
  position: ScaledPosition;
  selectedText: string;
  note: string | null;
  color: string;
  updatedAt: number;
}

export interface SerializedMaterial {
  id: number;
  title: string;
  type: string;
  blobUrl: string;
  fileName: string | null;
  fileSize: number | null;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

function MaterialUnavailable({ message }: { message: string }) {
  return (
    <main className="min-h-dvh bg-[#FAF5EF] px-5 py-12 text-[#1A0507]">
      <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center text-center">
        <span className="mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-[#D4B094]/50 bg-white text-[#760F13]">
          <AlertCircle className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="text-balance text-2xl font-semibold tracking-[-0.025em]">This material is not available</h1>
        <p className="mt-3 max-w-sm text-pretty text-base leading-6 text-[#6F4A43]">{message}</p>
        <div className="mt-7 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/dashboard" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#760F13] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#5A0B0F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#760F13]">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to learning
          </Link>
          <Link href="/dashboard" prefetch={false} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#D8C7BA] bg-white px-5 py-3 text-sm font-semibold text-[#5A0B0F] transition-colors hover:bg-[#F4ECE5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#760F13]">
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refresh dashboard
          </Link>
        </div>
        <p className="mt-5 text-sm text-[#8B655D]">If the class still shows this file, ask your instructor to reattach it.</p>
      </div>
    </main>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const materialId = parseInt(id, 10);
  if (isNaN(materialId)) return { title: 'Material — VH' };

  const material = await db
    .select({ title: materials.title })
    .from(materials)
    .where(eq(materials.id, materialId))
    .get();

  return { title: material ? `${material.title} — VH` : 'Material — VH' };
}

export default async function MaterialViewerPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');

  const user = await getUserByEmail(session.user.email);
  if (!user) redirect('/auth/signin');

  const { id } = await params;
  const materialId = parseInt(id, 10);
  if (isNaN(materialId)) return <MaterialUnavailable message="The material link is invalid." />;

  const material = await db
    .select()
    .from(materials)
    .where(eq(materials.id, materialId))
    .get();

  if (!material) {
    return <MaterialUnavailable message="This file may have been removed or replaced by your instructor." />;
  }

  if (!canAccessLmsContent(user, { product: material.product, batch: material.batch })) {
    return <MaterialUnavailable message="This file belongs to a different course or batch than your account." />;
  }

  // Only the PDF viewer makes sense; link-type materials should open externally
  if (material.type !== 'pdf') {
    // For links the blobUrl is always an http URL — redirect directly
    redirect(material.blobUrl);
  }

  // Fetch my highlights (never other users')
  const rawHighlights = await db
    .select()
    .from(materialHighlights)
    .where(
      and(
        eq(materialHighlights.materialId, materialId),
        eq(materialHighlights.userId, user.id),
      ),
    )
    .orderBy(asc(materialHighlights.pageNumber));

  const highlights: SerializedHighlight[] = rawHighlights.map((h) => ({
    id: h.id,
    materialId: h.materialId,
    pageNumber: h.pageNumber,
    position: JSON.parse(h.position) as ScaledPosition,
    selectedText: h.selectedText,
    note: h.note,
    color: h.color,
    updatedAt: h.updatedAt instanceof Date ? h.updatedAt.getTime() : Number(h.updatedAt),
  }));

  // Resolve the R2 key to a presigned GET URL (2 h TTL) for the PDF viewer.
  // For link-type materials we already redirected above, so this is always a key.
  const resolvedUrl = await resolveFileUrl(material.blobUrl).catch(() => null);
  if (!resolvedUrl) {
    return <MaterialUnavailable message="The file storage link could not be prepared. Please try again shortly." />;
  }

  const serializedMaterial: SerializedMaterial = {
    id: material.id,
    title: material.title,
    type: material.type,
    blobUrl: resolvedUrl,
    fileName: material.fileName,
    fileSize: material.fileSize,
  };

  const isAdmin = user.role === 'admin' || user.role === 'super_admin' || user.role === 'instructor';

  return (
    <MaterialViewer
      material={serializedMaterial}
      initialHighlights={highlights}
      isAdmin={isAdmin}
    />
  );
}

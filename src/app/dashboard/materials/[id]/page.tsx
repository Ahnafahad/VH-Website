/**
 * /dashboard/materials/[id] — PDF viewer with anchored highlights.
 * Server component: session guard → scope check → fetch highlights → render client.
 */

import { redirect } from 'next/navigation';
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
  if (isNaN(materialId)) redirect('/dashboard');

  const material = await db
    .select()
    .from(materials)
    .where(eq(materials.id, materialId))
    .get();

  if (!material) redirect('/dashboard');

  if (!canAccessLmsContent(user, { product: material.product, batch: material.batch })) {
    redirect('/dashboard');
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
  const resolvedUrl = (await resolveFileUrl(material.blobUrl)) ?? '';

  const serializedMaterial: SerializedMaterial = {
    id: material.id,
    title: material.title,
    type: material.type,
    blobUrl: resolvedUrl,
    fileName: material.fileName,
    fileSize: material.fileSize,
  };

  return (
    <MaterialViewer
      material={serializedMaterial}
      initialHighlights={highlights}
    />
  );
}

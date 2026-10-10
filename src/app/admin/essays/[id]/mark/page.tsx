'use client';

import { Suspense, use } from 'react';
import MarkingWorkspace from '@/components/admin/essays/MarkingWorkspace';

export default function MarkEssaySeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={null}>
      <MarkingWorkspace seriesId={Number(id)} />
    </Suspense>
  );
}

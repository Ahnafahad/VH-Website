'use client';

import { Suspense, use } from 'react';
import { useSearchParams } from 'next/navigation';
import TakeLevelScreen from '@/components/redline/TakeLevelScreen';

function LevelInner({ level }: { level: number }) {
  const replay = useSearchParams().get('replay') === '1';
  return <TakeLevelScreen level={level} replay={replay} />;
}

export default function RedlineLevelPage({ params }: { params: Promise<{ level: string }> }) {
  const { level } = use(params);
  return (
    <Suspense fallback={null}>
      <LevelInner level={Number(level)} />
    </Suspense>
  );
}

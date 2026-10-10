'use client';

import dynamic from 'next/dynamic';

const StackSmoke = dynamic(() => import('./StackSmoke'), { ssr: false });

export default function SmokeLoader() {
  return <StackSmoke />;
}
